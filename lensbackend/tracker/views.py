from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from django.contrib.auth import update_session_auth_hash
from django.core.mail import send_mail
from django.conf import settings
from .models import Task, Expense, Profile
from .serializers import ExpenseSerializer, ProfileSerializer

from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

import json
import random
import re
from datetime import datetime

from .models import Document


# ---------------- DASHBOARD ----------------
def dashboard(request):
    return render(request, 'dashboard.html')


# ---------------- TASKS ----------------

def get_tasks(request):

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Not authenticated"}, status=401)

    tasks = list(
        Task.objects.filter(user=request.user).values(
            'id', 'title', 'completed', 'deleted', 'date', 'created_at'
        )
    )

    for t in tasks:
        if not t['date'] and t['created_at']:
            t['date'] = t['created_at'].date().isoformat()

    return JsonResponse(tasks, safe=False)

@csrf_exempt
def add_task(request):
    if request.method == 'POST':
        if not request.user.is_authenticated:
            return JsonResponse({"error": "Not authenticated"}, status=401)

        try:
            data = json.loads(request.body)
            task_date = data.get('date')
            if task_date:
                task_date = datetime.strptime(task_date, "%Y-%m-%d").date()

            task = Task.objects.create(
                user=request.user,
                title=data['title'],
                date=task_date
            )

            return JsonResponse({
                'id': task.id,
                'title': task.title,
                'completed': task.completed,
                'date': task.date.isoformat() if task.date else None
            })

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
def update_task(request, pk):
    if request.method == 'PATCH':
        task = Task.objects.get(pk=pk)
        data = json.loads(request.body)

        task.completed = data.get('completed', task.completed)
        task.deleted = data.get('deleted', task.deleted)
        task.save()

        return JsonResponse({
            'id': task.id,
            'completed': task.completed,
            'deleted': task.deleted
        })

    return JsonResponse({'error': 'Invalid method'}, status=400)


@csrf_exempt
def delete_task(request, pk):
    if request.method == 'DELETE':
        task = Task.objects.get(pk=pk)

        if task.deleted:
            task.delete()
            return JsonResponse({'message': 'Task permanently deleted'})
        else:
            task.deleted = True
            task.save()
            return JsonResponse({'message': 'Task moved to recycle bin'})

    return JsonResponse({'error': 'Invalid method'}, status=400)


# ---------------- LOGIN ----------------
@csrf_exempt
def login_view(request):
    if request.method == "POST":
        data = json.loads(request.body)

        user = authenticate(
            request,
            username=data.get("username"),
            password=data.get("password")
        )

        if user:
            login(request, user)

            request.session.save()  # 🔥 IMPORTANT FIX

            return JsonResponse({
                "message": "Login successful",
                "username": user.username
            })

        return JsonResponse({"error": "Invalid credentials"}, status=400)


# ---------------- EXPENSES ----------------
def get_expenses(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Not authenticated"}, status=401)

    expenses = Expense.objects.filter(user=request.user, deleted=False)

    data = {
        "expenses": [
            {
                "id": e.id,
                "amount": e.amount,
                "category": e.category,
                "date": e.date.isoformat()
            }
            for e in expenses
        ]
    }

    return JsonResponse(data)


@csrf_exempt
def add_expense(request):
    if request.method == 'POST':
        data = json.loads(request.body)

        user = request.user  # ✅ FIXED

        date = datetime.strptime(data.get('date'), "%Y-%m-%d").date() \
            if data.get('date') else datetime.now().date()

        expense = Expense.objects.create(
            user=user,
            category=data.get('category'),
            amount=float(data.get('amount')),
            date=date
        )

        return JsonResponse({
            'id': expense.id,
            'amount': expense.amount,
            'category': expense.category,
            'date': expense.date.isoformat()
        })


@csrf_exempt
def update_expense(request, id):
    if request.method in ['PUT', 'PATCH']:
        try:
            expense = Expense.objects.get(id=id)
        except Expense.DoesNotExist:
            return JsonResponse({'error': 'Not found'}, status=404)

        data = json.loads(request.body)

        expense.amount = float(data.get('amount', expense.amount))
        expense.category = data.get('category', expense.category)

        if data.get('date'):
            expense.date = datetime.strptime(data.get('date'), "%Y-%m-%d").date()

        expense.save()

        return JsonResponse({
            'id': expense.id,
            'amount': expense.amount,
            'category': expense.category,
            'date': expense.date.isoformat()
        })

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def expense_delete(request, id):
    if request.method == 'DELETE':
        try:
            expense = Expense.objects.get(id=id)
            expense.delete()
            return JsonResponse({'message': 'Deleted'}, status=204)
        except Expense.DoesNotExist:
            return JsonResponse({'error': 'Not found'}, status=404)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


# ---------------- PROFILE (DRF) ----------------

@api_view(['GET', 'POST', 'PUT'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def profile_view(request):

    profile, created = Profile.objects.get_or_create(user=request.user)

    if request.method == 'GET':
        serializer = ProfileSerializer(profile, context={'request': request})
        return Response(serializer.data)

    username = request.data.get('username')

    if username:
        if User.objects.filter(username=username).exclude(id=request.user.id).exists():
            return Response({"error": "Username already taken"}, status=400)

        request.user.username = username
        request.user.save()

    profile.bio = request.data.get('bio', profile.bio)

    if request.FILES.get('profile_pic'):
        profile.profile_pic = request.FILES['profile_pic']

    profile.save()

    return Response({
        "username": request.user.username,
        "email": request.user.email,
        "bio": profile.bio,
        "profile_pic": profile.profile_pic.url if profile.profile_pic else None
    })


# ---------------- CHANGE PASSWORD ----------------

@csrf_exempt
def change_password(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Not logged in"}, status=401)

    data = json.loads(request.body)

    old_password = data.get("old_password")
    new_password = data.get("new_password")

    if not request.user.check_password(old_password):
        return JsonResponse({"error": "Wrong old password"}, status=400)

    if len(new_password) < 8:
        return JsonResponse({"error": "Password must be at least 8 characters"}, status=400)

    if not re.search(r"[A-Za-z]", new_password):
        return JsonResponse({"error": "Password must contain letters"}, status=400)

    if not re.search(r"\d", new_password):
        return JsonResponse({"error": "Password must contain numbers"}, status=400)

    request.user.set_password(new_password)
    request.user.save()

    update_session_auth_hash(request, request.user)
    login(request, request.user)

    return JsonResponse({"message": "Password changed successfully"})


# ---------------- OTP ----------------

otp_store = {}

@csrf_exempt
def send_otp(request):
    data = json.loads(request.body)
    email = data.get("email")

    try:
        user = User.objects.get(email=email)
    except:
        return JsonResponse({"error": "Email not found"}, status=404)

    otp = str(random.randint(100000, 999999))  # ✅ FIX: STRING OTP
    otp_store[email] = otp

    from_email = f"LifeLens <{settings.EMAIL_HOST_USER}>"

    send_mail(
        'LifeLens Password Reset 🔐',
        f'''
Hello,

Your OTP is: {otp}

Do not share it with anyone.

– LifeLens Team
''',
        from_email,
        [email],
        fail_silently=False,
    )

    return JsonResponse({"message": "OTP sent successfully"})
@csrf_exempt
def verify_otp(request):
    data = json.loads(request.body)

    email = data.get("email")
    otp = str(data.get("otp"))  # ✅ FIX STRING MATCH

    if email not in otp_store:
        return JsonResponse({"error": "OTP expired"}, status=400)

    if otp_store[email] != otp:
        return JsonResponse({"error": "Invalid OTP"}, status=400)

    return JsonResponse({"message": "OTP verified successfully"})

@csrf_exempt
def reset_password(request):
    data = json.loads(request.body)

    email = data.get("email")
    new_password = data.get("new_password")

    if not email or not new_password:
        return JsonResponse({"error": "Missing fields"}, status=400)

    try:
        user = User.objects.get(email=email)
    except:
        return JsonResponse({"error": "User not found"}, status=404)

    user.set_password(new_password)
    user.save()

    # clear OTP after success
    if email in otp_store:
        del otp_store[email]

    return JsonResponse({"message": "Password reset successful"})

# ---------------- SIGNUP ----------------
@csrf_exempt
def signup(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)

            username = data.get("username")
            email = data.get("email")
            password = data.get("password")

            # validation
            if not username or not email or not password:
                return JsonResponse({"error": "All fields required"}, status=400)

            if User.objects.filter(username=username).exists():
                return JsonResponse({"error": "Username already exists"}, status=400)

            if User.objects.filter(email=email).exists():
                return JsonResponse({"error": "Email already exists"}, status=400)

            # create user
            User.objects.create_user(
                username=username,
                email=email,
                password=password
            )

            return JsonResponse({"message": "User created successfully"})

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Only POST allowed"}, status=405)


# ---------------- DEBUG ----------------

def debug(request):
    return JsonResponse({
        "user": str(request.user),
        "authenticated": request.user.is_authenticated
    })


@csrf_exempt
@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_document(request):

    print("USER:", request.user)
    print("FILES:", request.FILES)
    print("DATA:", request.data)

    file = request.FILES.get('file')
    title = request.data.get('title')
    doc_type = request.data.get('doc_type')

    if not file:
        return Response({"error": "File missing"}, status=400)

    doc = Document.objects.create(
        user=request.user if request.user.is_authenticated else None,
        title=title,
        doc_type=doc_type,
        file=file
    )

    return Response({"message": "Upload success"})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_documents(request):

    docs = Document.objects.filter(user=request.user).order_by('-uploaded_at')

    data = []

    for d in docs:
        data.append({
            "id": d.id,
            "title": d.title,
            "type": d.doc_type,
            "file_url": d.file.url,
            "uploaded_at": d.uploaded_at
        })

    return Response(data)