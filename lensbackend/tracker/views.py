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
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
import json
import random
import re,os
from datetime import datetime
from .serializers import DocumentSerializer
from .models import Document
import requests
from collections import Counter
from django.utils import timezone
from datetime import timedelta
from django.core.cache import cache

from django.views.decorators.csrf import ensure_csrf_cookie

@ensure_csrf_cookie
def get_csrf(request):
    return JsonResponse({'message': 'CSRF cookie set'})


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
            request.session.save()

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




# ================= LIST =================
@api_view(['GET'])
def list_documents(request):
    try:
        

        docs = Document.objects.all().order_by('-uploaded_at')

        show_deleted = request.GET.get('deleted')

        if show_deleted == 'true':
            docs = Document.objects.filter(deleted=True)
        else:
            docs = Document.objects.filter(deleted=False)

        data = []
        for d in docs:
            data.append({
                "id": d.id,
                "title": d.title or "Untitled",
                "file": request.build_absolute_uri(d.file.url) if d.file else "",
                "doc_type": d.doc_type or "",
                "folder": d.folder or "",
                "uploaded_at": d.uploaded_at,
                "deleted": d.deleted,
                "shared": d.shared,
                 "starred": d.starred  
            })

        return Response(data)

    except Exception as e:
        print("LIST ERROR:", e)
        return Response({"error": str(e)}, status=500)


# ================= UPLOAD =================
@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_document(request):
    try:
        file = request.FILES.get('file')

        if not file:
            return Response({'error': 'No file'}, status=400)

        title = request.data.get('title') or file.name
        folder = request.data.get('folder') or "" 
        # ensure extension exists only once
        ext = os.path.splitext(file.name)[1].lower()

        if not title.lower().endswith(ext):
            title = f"{title}{ext}"

        file.name = title

        # ✅ NOW get extension from final name
        final_ext = os.path.splitext(file.name)[1].lower()

        # doc type detection
        if final_ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            doc_type = 'image'
        elif final_ext == '.pdf':
            doc_type = 'pdf'
        elif final_ext in ['.doc', '.docx']:
            doc_type = 'word'
        elif final_ext in ['.xls', '.xlsx']:
            doc_type = 'excel'
        else:
            doc_type = 'other'

        doc = Document.objects.create(
            user=request.user if request.user.is_authenticated else None,
            title=title,
            file=file,
            doc_type=doc_type,
            folder=folder
        )

        return Response({
            "message": "Uploaded",
            "id": doc.id,
            "file": request.build_absolute_uri(doc.file.url),
            "title": doc.title
        })

    except Exception as e:
        print("UPLOAD ERROR:", e)
        return Response({"error": str(e)}, status=500)


# ================= DELETE (SOFT DELETE) =================
@api_view(['DELETE'])
def delete_document(request, id):
    try:
        doc = get_object_or_404(Document, id=id)

        doc.deleted = True
        doc.save()

        return Response({"message": "Moved to trash"})

    except Exception as e:
        return Response({"error": str(e)}, status=500)


# ================= RESTORE =================
@api_view(['PUT'])
def restore_document(request, id):
    try:
        doc = get_object_or_404(Document, id=id)

        doc.deleted = False
        doc.save()

        return Response({"message": "Restored"})

    except Exception as e:
        return Response({"error": str(e)}, status=500)


# ================= PERMANENT DELETE =================
@api_view(['DELETE'])
def permanent_delete(request, id):
    try:
        doc = get_object_or_404(Document, id=id)

        # delete actual file
        if doc.file:
            doc.file.delete()

        doc.delete()

        return Response({"message": "Deleted permanently"})

    except Exception as e:
        return Response({"error": str(e)}, status=500)


# ================= DOWNLOAD =================
@api_view(['GET'])
def download_document(request, id):
    try:
        doc = get_object_or_404(Document, id=id)

        if not doc.file:
            return Response({"error": "File not found"}, status=404)

        return FileResponse(
            doc.file.open(),
            as_attachment=True,
            filename=doc.title
        )

    except Exception as e:
        return Response({"error": str(e)}, status=500)


# ================= RENAME =================
@api_view(['PUT'])
def rename_document(request, id):
    try:
        doc = get_object_or_404(Document, id=id)

        new_title = request.data.get('title')
        if not new_title:
            return Response({"error": "Title required"}, status=400)

        if doc.file:
            ext = os.path.splitext(doc.file.name)[1]
            new_filename = new_title + ext

            doc.file.name = f"documents/{new_filename}"  # 🔥 important

        doc.title = new_title
        doc.save()

        return Response({
            "message": "Renamed",
            "title": doc.title,
            "file": request.build_absolute_uri(doc.file.url)
        })

    except Exception as e:
        return Response({"error": str(e)}, status=500)


# ================= SHARE =================
@api_view(['PUT'])
def share_document(request, id):
    try:
        doc = get_object_or_404(Document, id=id)

        doc.shared = True
        doc.save()

        return Response({
            "message": "Shared",
            "link": request.build_absolute_uri(doc.file.url)
        })

    except Exception as e:
        return Response({"error": str(e)}, status=500)
    
@api_view(['PUT'])
@parser_classes([MultiPartParser, FormParser])
def edit_document(request, id):
    try:
        doc = get_object_or_404(Document, id=id)

        # Update title
        new_title = request.data.get('title')
        if new_title:
            doc.title = new_title

        # Update folder
        folder = request.data.get('folder')
        if folder is not None:
            doc.folder = folder

        # Update file if provided
        file = request.FILES.get('file')
        if file:
            if doc.file:
                doc.file.delete()  # remove old file
            doc.file = file

            # Optional: update doc_type
            ext = os.path.splitext(file.name)[1].lower()
            if ext in ['.jpg', '.jpeg', '.png', '.gif']:
                doc.doc_type = 'image'
            elif ext == '.pdf':
                doc.doc_type = 'pdf'
            elif ext in ['.doc', '.docx']:
                doc.doc_type = 'word'
            elif ext in ['.xls', '.xlsx']:
                doc.doc_type = 'excel'
            else:
                doc.doc_type = 'other'

        doc.save()

        return Response({
            "message": "Document updated",
            "id": doc.id,
            "title": doc.title,
            "file": request.build_absolute_uri(doc.file.url) if doc.file else ""
        })

    except Exception as e:
        return Response({"error": str(e)}, status=500)

        
@api_view(['PUT'])
def toggle_star(request, id):
    try:
        doc = get_object_or_404(Document, id=id)

        doc.starred = not doc.starred
        doc.save()

        return Response({
            "message": "Star toggled",
            "starred": doc.starred
        })

    except Exception as e:
        return Response({"error": str(e)}, status=500)
    




from django.utils.timezone import localdate

def get_today():
    return localdate()

# =========== Insights ================
from django.db.models import Sum
from django.utils import timezone
from datetime import timedelta
import calendar
import requests

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Task, Expense


# =====================================================
# 🤖 AI
# =====================================================
def ask_ai(prompt):
    try:
        res = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "phi3:mini",
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.2}
            },
            timeout=30
        )

        if res.status_code != 200:
            return "⚠️ AI error"

        text = res.json().get("response", "")

        for bad in ["###", "System", "User:", "Assistant:", "Instruction"]:
            text = text.replace(bad, "")

        return text.strip()

    except:
        return "⚠️ AI unavailable"


# =====================================================
# 📅 CURRENT MONTH
# =====================================================
def current_month_range():
    today = get_today()
    start = today.replace(day=1)

    if today.month == 12:
        end = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
    else:
        end = today.replace(month=today.month + 1, day=1) - timedelta(days=1)

    return start, end


# =====================================================
# 📅 MONTH NAME SUPPORT (IMPORTANT FIX)
# =====================================================
def resolve_month_name(message):
    msg = message.lower()
    today = get_today()

    for i, m in enumerate(calendar.month_name):
        if m and m.lower() in msg:
            year = today.year

            start = timezone.datetime(year, i, 1).date()

            if i == 12:
                end = timezone.datetime(year + 1, 1, 1).date() - timedelta(days=1)
            else:
                end = timezone.datetime(year, i + 1, 1).date() - timedelta(days=1)

            return start, end

    return None, None


# =====================================================
# 🧠 DATE PARSER
# =====================================================
def resolve_date_range(message):
    import re
    from datetime import datetime

    # ================= FORMAT: "jan 23" or "23 jan" =================
    match2 = re.search(
        r'\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b|\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b',
        message,
        re.IGNORECASE
    )

    if match2:
        months = {
            "jan": 1, "feb": 2, "mar": 3, "apr": 4,
            "may": 5, "jun": 6, "jul": 7, "aug": 8,
            "sep": 9, "oct": 10, "nov": 11, "dec": 12
        }

        if match2.group(1):  # jan 23
            month = months[match2.group(1).lower()]
            day = int(match2.group(2))
        else:  # 23 jan
            day = int(match2.group(3))
            month = months[match2.group(4).lower()]

        year = datetime.today().year

        try:
            d = datetime(year, month, day).date()
            return d, d
        except:
            pass

    # ================= TEXT DATE FORMAT (23rd April) =================
    match = re.search(r'\b(\d{1,2})(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b', message, re.IGNORECASE)

    if match:
        day = int(match.group(1))
        month_str = match.group(3).lower()

        months = {
            "january": 1, "february": 2, "march": 3, "april": 4,
            "may": 5, "june": 6, "july": 7, "august": 8,
            "september": 9, "october": 10, "november": 11, "december": 12
        }

        month = months[month_str]
        year = datetime.today().year  # default current year

        try:
            d = datetime(year, month, day).date()
            return d, d
        except:
            pass
    today = get_today()
    msg = message.lower()

    # ================= BASIC =================
    if "today" in msg:
        return today, today

    if "yesterday" in msg:
        y = today - timedelta(days=1)
        return y, y

    if "day before yesterday" in msg:
        d = today - timedelta(days=2)
        return d, d

    # ================= LAST WEEKDAY (MON–SUN) =================
    weekdays = {
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
        "sunday": 6,
    }

    for day_name, day_index in weekdays.items():
        if f"last {day_name}" in msg:

            today_index = today.weekday()

            # how many days back to that weekday
            diff = (today_index - day_index) % 7

            # if same day → go 7 days back
            if diff == 0:
                diff = 7

            target_day = today - timedelta(days=diff)

            return target_day, target_day

    # ================= CURRENT WEEK =================
    if "week" in msg:
        days_since_sunday = (today.weekday() + 1) % 7
        start = today - timedelta(days=days_since_sunday)
        return start, today

    # ================= CURRENT MONTH =================
    if "month" in msg:
        start = today.replace(day=1)
        return start, today

    return None, None


# =====================================================
# 📊 INSIGHTS
# =====================================================
@api_view(['GET'])
@permission_classes([AllowAny])
def get_insights(request):

    tasks = Task.objects.filter(deleted=False)
    expenses = Expense.objects.filter(deleted=False)

    income_qs = expenses.filter(amount__gt=0)
    expense_qs = expenses.filter(amount__lt=0)

    total_income = income_qs.aggregate(total=Sum('amount'))['total'] or 0
    total_expense = abs(expense_qs.aggregate(total=Sum('amount'))['total'] or 0)

    completed = tasks.filter(completed=True).count()
    total_tasks = tasks.count()

    return Response({
        "total_tasks": total_tasks,
        "completed_tasks": completed,
        "productivity_rate": round((completed / total_tasks) * 100, 2) if total_tasks else 0,

        "total_income": float(total_income),
        "total_expense": float(total_expense),
        "balance": float(total_income - total_expense),

        "income_breakdown": [
            {"category": i["category"], "amount": float(i["total"])}
            for i in income_qs.values('category').annotate(total=Sum('amount'))
        ],

        "expense_breakdown": [
            {"category": i["category"], "amount": float(abs(i["total"]))}
            for i in expense_qs.values('category').annotate(total=Sum('amount'))
        ]
    })


# =====================================================
# 💬 CHAT (FINAL PERFECT VERSION)
# =====================================================
@api_view(['POST'])
@permission_classes([AllowAny])
def chat_view(request):

    message = request.data.get("message", "").lower()
    
    # =====================================================
# 🔥 FINAL DATE RANGE ENGINE (FIXED ORDER)
# =====================================================

    message_lower = message.lower()
    is_expense_query = "expense" in message_lower or "expenses" in message_lower
    is_income_query = "income" in message_lower
    is_task_query = "task" in message_lower
    today = get_today()

    start, end = None, None

    # ================= 1. MONTH NAME (April, March etc) =================
    MONTHS = {
        "january": 1, "jan": 1,
        "february": 2, "feb": 2,
        "march": 3, "mar": 3,
        "april": 4, "apr": 4,
        "may": 5,
        "june": 6, "jun": 6,
        "july": 7, "jul": 7,
        "august": 8, "aug": 8,
        "september": 9, "sep": 9, "sept": 9,
        "october": 10, "oct": 10,
        "november": 11, "nov": 11,
        "december": 12, "dec": 12,
    }

    month_found = None
    month_num = None

    for name, num in MONTHS.items():
        if name in message_lower:
            month_found = name
            month_num = num
            break

    is_task_request = any(x in message_lower for x in ["task", "pending", "completed"])

    # ================= DATE PRIORITY (🔥 ADD HERE) =================
    start2, end2 = resolve_date_range(message)

    if start2 and end2:

        day_tasks = Task.objects.filter(
            deleted=False,
            created_at__date__range=[start2, end2]
        )

        expense_qs_day = Expense.objects.filter(
            deleted=False,
            date__range=[start2, end2],
            amount__lt=0
        )

        income_qs_day = Expense.objects.filter(
            deleted=False,
            date__range=[start2, end2],
            amount__gt=0
        )

        # 💸 EXPENSE
        if "expense" in message_lower:
            return Response({
                "reply": f"💸 {start2} Expenses ({expense_qs_day.count()}): " +
                        (", ".join([f"{e.category} ₹{abs(e.amount)}" for e in expense_qs_day]) or "None")
            })

        # 💵 INCOME
        if "income" in message_lower:
            return Response({
                "reply": f"💵 {start2} Income ({income_qs_day.count()}): " +
                        (", ".join([f"{e.category} ₹{e.amount}" for e in income_qs_day]) or "None")
            })

        total_expense = abs(expense_qs_day.aggregate(total=Sum('amount'))['total'] or 0)
        total_income = income_qs_day.aggregate(total=Sum('amount'))['total'] or 0

        return Response({
            "reply": (
                f"📊 {start2} Summary:\n"
                f"📝 Tasks: {day_tasks.count()}\n"
                f"💸 Expenses: ₹{total_expense}\n"
                f"💵 Income: ₹{total_income}"
            )
        })
    # ================= MONTH DIRECT RESPONSE =================
    if month_found:

        try:
            # 📅 Date range
            start = today.replace(year=today.year, month=month_num, day=1)

            if month_num == 12:
                end = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                end = today.replace(month=month_num + 1, day=1) - timedelta(days=1)

            # 📋 Tasks
            month_tasks = Task.objects.filter(
                deleted=False,
                created_at__date__range=[start, end]
            )

            # 💸 Expenses
            expense_qs = Expense.objects.filter(
                deleted=False,
                date__range=[start, end],
                amount__lt=0
            )

            month_expense = expense_qs.aggregate(total=Sum('amount'))['total'] or 0
            month_expense = abs(month_expense)

            # 💵 Income
            income_qs = Expense.objects.filter(
                deleted=False,
                date__range=[start, end],
                amount__gt=0
            )

            month_income = income_qs.aggregate(total=Sum('amount'))['total'] or 0

            # ================= TASKS =================
            if is_task_request:
                pending = month_tasks.filter(completed=False)

                if "pending" in message_lower:
                    return Response({
                        "reply": f"📌 {month_found.title()} Pending Tasks ({pending.count()}): " +
                                (", ".join([t.title for t in pending[:5]]) or "None")
                    })

                if "completed" in message_lower:
                    done = month_tasks.filter(completed=True)
                    return Response({
                        "reply": f"✅ {month_found.title()} Completed Tasks ({done.count()}): " +
                                (", ".join([t.title for t in done[:5]]) or "None")
                    })

                return Response({
                    "reply": f"📝 {month_found.title()} Tasks ({month_tasks.count()}): " +
                            (", ".join([t.title for t in month_tasks[:5]]) or "None")
                })

            # ================= EXPENSE =================
            elif "expense" in message_lower:

                if not expense_qs.exists():
                    return Response({
                        "reply": f"💸 {month_found.title()} Expenses (0): None"
                    })

                return Response({
                    "reply": f"💸 {month_found.title()} Expenses ({expense_qs.count()}): " +
                            ", ".join([f"{e.category} ₹{abs(e.amount)}" for e in expense_qs[:5]])
                })

            # ================= INCOME =================
            elif "income" in message_lower:

                if not income_qs.exists():
                    return Response({
                        "reply": f"💵 {month_found.title()} Income (0): None"
                    })

                return Response({
                    "reply": f"💵 {month_found.title()} Income ({income_qs.count()}): " +
                            ", ".join([f"{e.category} ₹{e.amount}" for e in income_qs[:5]])
                })

            # ================= SUMMARY (DEFAULT) =================
            return Response({
                "reply": (
                    f"📅 {month_found.title()} Summary:\n"
                    f"📝 Tasks: {month_tasks.count()}\n"
                    f"💸 Expenses: ₹{month_expense}\n"
                    f"💵 Income: ₹{month_income}"
                )
            })

        except Exception as e:
            print("MONTH ERROR:", str(e))  # Debug in terminal
            return Response({
                "reply": "❌ Error processing month data"
            })
    # ================= 2. CURRENT MONTH (1st → TODAY) =================
    if not start and "month" in message_lower:
        start = today.replace(day=1)
        end = today   # IMPORTANT

    # ================= 3. WEEK / DAYS / CUSTOM RANGE =================
    if not start:
        start2, end2 = resolve_date_range(message)
        if start2:
            start, end = start2, end2

    # ================= 4. DEFAULT =================
    if not start:
        start, end = current_month_range()

# ================= FIXED TASK QUERIES =================

    all_tasks = Task.objects.filter(deleted=False)

    tasks = all_tasks.filter(
        created_at__date__range=[start, end]
    )


    expenses = Expense.objects.filter(
        deleted=False,
        date__range=[start, end]
    )

    expense_qs = expenses.filter(amount__lt=0)
    income_qs = expenses.filter(amount__gt=0)

    total_income = income_qs.aggregate(total=Sum('amount'))['total'] or 0
    total_expense = abs(expense_qs.aggregate(total=Sum('amount'))['total'] or 0)
    balance = total_income - total_expense

    # ================= GREETING =================
    if any(x in message for x in ["hi", "hello", "hey"]):
        return Response({
            "reply": f"👋 Hi! Tasks: {tasks.count()}, Income: ₹{total_income}, Expense: ₹{total_expense}, Balance: ₹{balance}"
        })
    
    
    # ================= CATEGORY SEARCH (🔥 MOVED UP FIX) =================
    for cat in ["food", "travel", "rent", "shopping", "salary"]:

        if cat in message:

            data = expense_qs.filter(category__icontains=cat).values('category').annotate(
                total=Sum('amount')
            )

            if not data:
                return Response({
                    "reply": f"❌ No {cat} expenses found in selected month.",
                    "breakdown": []
                })

            breakdown = [
                {"category": i["category"], "amount": float(abs(i["total"]))}
                for i in data
            ]

            total = sum(i["amount"] for i in breakdown)

            return Response({
                "reply": f"📊 {cat} expenses: ₹{total}",
                "breakdown": breakdown
            })
        
    # ================= TASKS (GLOBAL PRIORITY FIX) =================
    if "pending" in message:
        pending = all_tasks.filter(deleted=False, completed=False)

        return Response({
            "reply": f"📌 Pending Tasks ({pending.count()}): " +
                    ", ".join([t.title for t in pending[:5]])
        })


    if "completed" in message:
        done = all_tasks.filter(deleted=False, completed=True)

        return Response({
            "reply": f"✅ Completed Tasks ({done.count()}): " +
                    ", ".join([t.title for t in done[:5]])
        })
    
    # ================= EXPENSE LIST =================
    if "expenses list" in message or "show expenses" in message:

        exp_list = Expense.objects.filter(deleted=False)

        return Response({
            "reply": f"📌 Expenses ({exp_list.count()}): " +
                    ", ".join([f"{e.category} ₹{abs(e.amount)}" for e in exp_list[:5]])
        })
    
    # ================= TASKS (GENERAL + MONTH SUPPORT) =================
    if "task" in message:

        if not tasks.exists():
            return Response({
                "reply": "❌ No tasks found in selected month."
            })

        return Response({
            "reply": f"📝 Tasks ({tasks.count()}): " +
                    ", ".join([t.title for t in tasks[:5]])
        })

    # ================= EXPENSE =================
    if "expense" in message:

        data = expense_qs.values('category').annotate(total=Sum('amount'))

        breakdown = [
            {"category": i["category"], "amount": float(abs(i["total"]))}
            for i in data
        ]

        return Response({
            "reply": f"💰 Total Expense: ₹{float(total_expense)}",
            "breakdown": breakdown
        })

    # ================= INCOME =================
    if "income" in message:

        data = income_qs.values('category').annotate(total=Sum('amount'))

        breakdown = [
            {"category": i["category"], "amount": float(i["total"])}
            for i in data
        ]

        return Response({
            "reply": f"💵 Total Income: ₹{float(total_income)}",
            "breakdown": breakdown
        })

    # ================= BALANCE =================
    if "balance" in message:
        return Response({
            "reply": f"💰 Income: ₹{total_income} | Expense: ₹{total_expense} | Balance: ₹{balance}"
        })

    

    # ================= AI =================
    return Response({
        "reply": ask_ai(f"You are a helpful assistant. User said: {message}")
    })