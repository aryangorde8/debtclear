from django.urls import path

from . import views

urlpatterns = [
    path("analyze/", views.analyze, name="analyze"),
    path("negotiate/", views.negotiate, name="negotiate"),
    path("health/", views.health, name="health"),
]
