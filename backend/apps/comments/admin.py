from django.contrib import admin

from apps.comments.models import Comment


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "ticket", "author", "created_at", "edited_at", "deleted_at")
    list_filter = ("deleted_at",)
    search_fields = ("ticket__title", "author__email", "body")
