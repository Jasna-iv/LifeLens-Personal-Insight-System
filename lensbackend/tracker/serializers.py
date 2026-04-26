
from rest_framework import serializers
from .models import Expense
from .models import Profile

from .models import Document
class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = ['id', 'amount', 'category', 'date']

from rest_framework import serializers
from .models import Profile

class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    profile_pic = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ['id', 'bio', 'profile_pic', 'username', 'email']


    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})

        # update username
        if 'username' in user_data:
            instance.user.username = user_data['username']
            instance.user.save()

        return super().update(instance, validated_data)
    
    def get_profile_pic(self, obj):
        request = self.context.get('request')

        if obj.profile_pic and hasattr(obj.profile_pic, 'url'):
            url = obj.profile_pic.url
            if request:
                return request.build_absolute_uri(url)
            return url

        return None
    


from rest_framework import serializers
from .models import Document

class DocumentSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()
    size = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id',
            'title',
            'file',
            'doc_type',
            'folder',
            'deleted',
            'shared',
            'size',
            'uploaded_at'
        ]

    def get_file(self, obj):
        request = self.context.get('request')
        return request.build_absolute_uri(obj.file.url)

    def get_size(self, obj):
        return f"{round(obj.file.size / 1024, 1)} KB"