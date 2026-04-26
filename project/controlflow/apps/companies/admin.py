from django.contrib import admin
from .models import Company, CompanyMember


class CompanyMemberInline(admin.TabularInline):
    model = CompanyMember
    extra = 0
    readonly_fields = ['id', 'created_at']
    fields = ['id', 'user', 'role', 'status', 'invited_by', 'joined_at', 'created_at']


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ['name', 'owner', 'members_count', 'created_at']
    list_filter = ['created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']
    inlines = [CompanyMemberInline]
    fieldsets = (
        ('Основная информация', {
            'fields': ('id', 'name', 'description', 'owner')
        }),
        ('Системные поля', {
            'fields': ('created_at', 'updated_at', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(CompanyMember)
class CompanyMemberAdmin(admin.ModelAdmin):
    list_display = ['id', 'company', 'user', 'role', 'status', 'invited_by', 'created_at']
    list_filter = ['status', 'role', 'company']
    search_fields = ['company__name', 'user__email', 'user__first_name']
    readonly_fields = ['id', 'created_at']