"""Acumen Night Render - Telegram bot.

Sales send a daytime render (optionally marked in red) and get back a
photorealistic night render with Acumen's architectural lighting.
"""

import asyncio
import io
import logging
import os

from dotenv import load_dotenv
from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from gemini_render import render_night_image
from prompt import WELCOME_MESSAGE

load_dotenv()

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("acumen-bot")

TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]

# Remember each user's last source image, so a text-only message becomes an
# adjustment ("warmer", "dimmer") re-rendered from the original image.
_last_source: dict[int, tuple[bytes, str]] = {}


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(WELCOME_MESSAGE)


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.message
    photo = message.photo[-1]  # highest resolution version
    tg_file = await photo.get_file()
    image_bytes = bytes(await tg_file.download_as_bytearray())
    _last_source[message.from_user.id] = (image_bytes, "image/jpeg")
    await _render_and_reply(update, context, image_bytes, "image/jpeg", message.caption)


async def handle_image_document(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Images sent as a file (uncompressed) keep full quality."""
    message = update.message
    document = message.document
    tg_file = await document.get_file()
    image_bytes = bytes(await tg_file.download_as_bytearray())
    mime = document.mime_type or "image/png"
    _last_source[message.from_user.id] = (image_bytes, mime)
    await _render_and_reply(update, context, image_bytes, mime, message.caption)


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.message
    saved = _last_source.get(message.from_user.id)
    if saved is None:
        await message.reply_text(
            "ابعتلي أول إشي الصورة النهارية (معلّمة بالأحمر إذا في)، "
            "وبعدها بتقدر تطلب تعديلات بالكتابة. 🙂"
        )
        return
    image_bytes, mime = saved
    await _render_and_reply(update, context, image_bytes, mime, message.text)


async def _render_and_reply(update, context, image_bytes, mime, instructions):
    message = update.message
    await context.bot.send_chat_action(message.chat_id, ChatAction.UPLOAD_PHOTO)
    status = await message.reply_text("⏳ جاري تجهيز الرندر الليلي...")
    try:
        result = await asyncio.to_thread(
            render_night_image, image_bytes, mime, instructions or ""
        )
    except Exception:
        logger.exception("Render failed")
        await status.edit_text(
            "صار في خطأ بالمعالجة 😕 جرّب كمان مرة بعد دقيقة، وإذا ظل احكيلي."
        )
        return

    await context.bot.send_photo(
        chat_id=message.chat_id,
        photo=io.BytesIO(result),
        caption=(
            "تفضّل ✨\n"
            "لتعديل الإضاءة اكتبلي مباشرة — مثلاً: «أدفأ شوي» أو «زيد الأب لايت عل الأعمدة»."
        ),
    )
    try:
        await status.delete()
    except Exception:
        pass


def main() -> None:
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.Document.IMAGE, handle_image_document))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    logger.info("Acumen Night Render bot is running. Press Ctrl+C to stop.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
