from django.contrib import admin

from apps.goals.models import WeeklyBoard, WeeklyGoalItem


class WeeklyGoalItemInline(admin.TabularInline):
    model = WeeklyGoalItem
    extra = 0
    fields = ("text", "is_done", "order", "completed_by", "completed_at")
    readonly_fields = ("completed_at",)


@admin.register(WeeklyBoard)
class WeeklyBoardAdmin(admin.ModelAdmin):
    list_display = ("workspace", "week_start", "created_by", "created_at")
    list_filter = ("week_start",)
    search_fields = ("workspace__name",)
    inlines = [WeeklyGoalItemInline]


@admin.register(WeeklyGoalItem)
class WeeklyGoalItemAdmin(admin.ModelAdmin):
    list_display = ("text", "board", "is_done", "order", "completed_by", "completed_at")
    list_filter = ("is_done",)
    search_fields = ("text",)
