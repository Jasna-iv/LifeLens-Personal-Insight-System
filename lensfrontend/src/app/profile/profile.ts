import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css']
})
export class ProfileComponent implements OnInit {

  profile: any = null;
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  editMode = false;

  // ✅ TAB SYSTEM (IMPORTANT)
  selectedTab: string = 'profile';

  passwordData = {
  old_password: '',
  new_password: '',
  confirm_password: ''
};

notifications = {
  email: true,
  sms: false,
  app: true
};
showOld = false;
showNew = false;
showConfirm = false;
 constructor(
  private http: HttpClient,
  private cd: ChangeDetectorRef,
  private router: Router
) {}

  ngOnInit() {
    this.getProfile();
  }
  refreshKey = Date.now();


  // ================= GET PROFILE =================
  getProfile() {
    this.http.get('http://localhost:8000/profile/', {
      withCredentials: true
    }).subscribe({
      next: (res: any) => {
        this.profile = res;
        this.cd.detectChanges();
      },
      error: (err) => console.error(err)
    });
  }

  // ================= TAB CONTROL =================
  setTab(tab: string) {
    this.selectedTab = tab;

    if (tab !== 'edit') {
      this.editMode = false;
      this.selectedFile = null;
      this.previewUrl = null;
    }
  }

  // ================= EDIT OPEN =================
  enableEdit() {
    this.selectedTab = 'edit';
    this.editMode = true;
  }

  // ================= CANCEL =================
  cancelEdit() {
    this.editMode = false;
    this.selectedFile = null;
    this.previewUrl = null;
    this.setTab('profile');
    this.getProfile();
  }

  // ================= IMAGE PREVIEW =================
onFileChange(event: any) {
  const file = event.target.files[0];

  if (file) {
    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl = reader.result as string; // ✅ MUST set this
      this.cd.detectChanges();
    };
    reader.readAsDataURL(file);
  }
}
  // ================= CSRF (optional) =================
getCsrfToken(): string {
  const name = 'csrftoken=';
  const decoded = decodeURIComponent(document.cookie);
  const ca = decoded.split(';');

  for (let c of ca) {
    c = c.trim();
    if (c.indexOf(name) === 0) {
      return c.substring(name.length);
    }
  }
  return '';
}

  // ================= SAVE =================
saveProfile() {
  const formData = new FormData();
  
  // ✅ ADD USERNAME
  formData.append('username', this.profile.username || '');

  // existing fields
  formData.append('bio', this.profile.bio || '');

  if (this.selectedFile) {
    formData.append('profile_pic', this.selectedFile);
  }

  this.http.post('http://localhost:8000/profile/', formData, {
    withCredentials: true,
    headers: {
      'X-CSRFToken': this.getCsrfToken()
    }
  }).subscribe({
   next: (res: any) => {

  // ✅ Clear preview FIRST (important)
  this.previewUrl = null;

  // ✅ Update profile
  this.profile = res;

  // ✅ Force image reload
  this.refreshKey = Date.now();

  // ❗🔥 CRITICAL FIX: re-fetch from backend
  this.getProfile();

  this.editMode = false;
  this.selectedFile = null;
  this.selectedTab = 'profile';

  alert("Profile updated!");
},

    error: (err) => {
      console.log("UPLOAD ERROR:", err);
      alert("Upload failed");
    }
  });
}
changePassword() {

  if (this.passwordData.new_password !== this.passwordData.confirm_password) {
    alert("Passwords do not match!");
    return;
  }

  this.http.post('http://localhost:8000/change-password/', {
    old_password: this.passwordData.old_password,
    new_password: this.passwordData.new_password
  }, {
    withCredentials: true
  }).subscribe({
    next: (res: any) => {

      alert(res.message || "Password changed successfully!");

      // reset form
      this.passwordData = {
        old_password: '',
        new_password: '',
        confirm_password: ''
      };

      // ✅ THIS IS THE REAL FIX
      this.selectedTab = 'profile';

      // refresh profile data
      this.getProfile();
    },

    error: (err) => {
      console.error(err);
      alert(err.error?.error || "Password change failed");
    }
  });
}

saveNotifications() {

  this.http.post('http://localhost:8000/notifications/', this.notifications, {
    withCredentials: true
  }).subscribe({
    next: () => {
      alert("Notification settings saved!");
    },
    error: (err) => {
      console.error(err);
    }
  });
}

  goToDashboard() { this.router.navigate(['/dashboard']); }
  goToTasks() { this.router.navigate(['/tasks']); }
  goToExpenses() {this.router.navigate(['/expenses']);}
  goToDocuments() {this.router.navigate(['/documents']);}
  goToInsights() {this.router.navigate(['/insights']);}
  logout() { this.router.navigate(['']); }
}