from django.urls import path

from . import views

urlpatterns = [
    path("analyze/", views.analyze, name="analyze"),
    path("simulate/", views.simulate, name="simulate"),
    path("negotiate/", views.negotiate, name="negotiate"),
    path("roleplay/", views.roleplay, name="roleplay"),
    path("letter/", views.settlement_letter, name="settlement_letter"),
    path("chat/", views.chat, name="chat"),
    path("health/", views.health, name="health"),
]
