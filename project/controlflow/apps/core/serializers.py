from rest_framework import serializers
from .models import Project


class ProjectSerializer(serializers.ModelSerializer):
    owner_name = serializers.SerializerMethodField()
    tasks_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description', 'code', 'status',
            'owner', 'owner_name', 'start_date', 'end_date', 'deadline',
            'tasks_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']

    def get_owner_name(self, obj):
        return obj.owner.full_name if obj.owner else ''

    def get_tasks_count(self, obj):
        return obj.tasks.filter(deleted_at__isnull=True).count()


class ProjectCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'code', 'status', 'start_date', 'end_date', 'deadline']
        read_only_fields = ['id']
