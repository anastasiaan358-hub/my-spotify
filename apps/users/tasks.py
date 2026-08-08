from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.core.management import call_command
from django.utils import timezone

from apps.users import emails
from apps.users.models import RevokedTokenChain, User


@shared_task(autoretry_for=(OSError,), retry_backoff=True, max_retries=5)
def send_email_verification(user_id: int) -> None:
    user = User.objects.filter(pk=user_id, is_active=True).first()
    if user is None:
        return
    subject, body = emails.email_verification_message(user)
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email])


@shared_task
def flush_expired_tokens() -> None:
    """Ночная чистка (§7.4): протухшие outstanding/blacklist-записи simplejwt и
    отзывы цепочек, которые уже пережили срок жизни refresh-токена."""
    call_command("flushexpiredtokens")
    RevokedTokenChain.objects.filter(expires_at__lte=timezone.now()).delete()


@shared_task(autoretry_for=(OSError,), retry_backoff=True, max_retries=5)
def send_password_reset(user_id: int) -> None:
    user = User.objects.filter(pk=user_id, is_active=True).first()
    if user is None:
        return
    subject, body = emails.password_reset_message(user)
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email])
