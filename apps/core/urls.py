from django.urls import path

from apps.core import views

urlpatterns = [
    path("ping", views.PingView.as_view()),
    path("scores/<slug:catalog_id>/<str:work_id>", views.printable_score),
    path("youtube/stream/<str:video_id>", views.youtube_stream),
]
