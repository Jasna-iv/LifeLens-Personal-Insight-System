import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.css']
})
export class ForgotPasswordComponent {

  email = '';
  otp = '';
  newPassword = '';
  confirmPassword = '';

  step = 1;

  message = '';
  error = '';

  sendLoading = false;
  verifyLoading = false;
  resetLoading = false;

  savedEmail = '';

  // 👁 TOGGLE STATES
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cd: ChangeDetectorRef
  ) {}

  // ================= TOAST HELPERS =================
  showMessage(msg: string) {
    this.message = msg;
    this.error = '';
    this.cd.detectChanges();

    setTimeout(() => {
      this.message = '';
      this.cd.detectChanges();
    }, 2000);
  }

  showError(msg: string) {
    this.error = msg;
    this.message = '';
    this.cd.detectChanges();

    setTimeout(() => {
      this.error = '';
      this.cd.detectChanges();
    }, 2000);
  }

  // ================= PASSWORD VALIDATION =================
  validatePassword(password: string): string | null {

    if (password.length < 8) {
      return "Password must be at least 8 characters";
    }

    if (!/[A-Z]/.test(password)) {
      return "Must include 1 uppercase letter";
    }

    if (!/[a-z]/.test(password)) {
      return "Must include 1 lowercase letter";
    }

    if (!/[0-9]/.test(password)) {
      return "Must include 1 number";
    }

    if (!/[!@#$%^&*(),.?\":{}|<>]/.test(password)) {
      return "Must include 1 special character";
    }

    return null;
  }

  // ================= SEND OTP =================
  sendOtp() {

    this.message = '';
    this.error = '';

    if (!this.email) {
      this.showError("Please enter email");
      return;
    }

    this.sendLoading = true;

    const emailToSend = this.email;

    this.http.post('http://localhost:8000/send-otp/', {
      email: emailToSend
    }).subscribe({
      next: (res: any) => {

        this.sendLoading = false;

        this.savedEmail = emailToSend;

        this.email = '';
        this.step = 2;

        this.showMessage(res.message);
      },

      error: (err) => {

        this.sendLoading = false;

        this.showError(err.error?.error || "Email not found");
      }
    });
  }

  // ================= VERIFY OTP =================
  verifyOtp() {

    this.message = '';
    this.error = '';

    if (!this.otp) {
      this.showError("Enter OTP");
      return;
    }

    this.verifyLoading = true;

    this.http.post('http://localhost:8000/verify-otp/', {
      email: this.savedEmail,
      otp: this.otp
    }).subscribe({
      next: (res: any) => {

        this.verifyLoading = false;

        this.otp = '';
        this.step = 3;

        this.showMessage(res.message);
      },

      error: (err) => {

        this.verifyLoading = false;

        this.showError(err.error?.error || "Invalid OTP");
      }
    });
  }

  // ================= RESET PASSWORD =================
  resetPassword() {

    this.message = '';
    this.error = '';

    const pwdError = this.validatePassword(this.newPassword);
    if (pwdError) {
      this.showError(pwdError);
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.showError("Passwords do not match");
      return;
    }

    this.resetLoading = true;

    this.http.post('http://localhost:8000/reset-password/', {
      email: this.savedEmail,
      new_password: this.newPassword
    }).subscribe({
      next: (res: any) => {

        this.resetLoading = false;

        this.showMessage(res.message);

        setTimeout(() => {
          this.router.navigate(['']);
        }, 1200);

        // reset everything
        this.step = 1;
        this.email = '';
        this.otp = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.savedEmail = '';
        this.showPassword = false;
        this.showConfirmPassword = false;
      },

      error: (err) => {

        this.resetLoading = false;

        this.showError(err.error?.error || "Reset failed");
      }
    });
  }

  goToLogin() {
    this.router.navigate(['']);
  }
}