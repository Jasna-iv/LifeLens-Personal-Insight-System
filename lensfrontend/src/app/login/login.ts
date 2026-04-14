import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {

  username = '';
  password = '';
  rememberMe = false;
  showPassword = false;
  error = '';

  forgotEmail = '';
  otp = '';
  newPassword = '';
  step = 1;

  // 🔥 LOADING STATE
  loading = false;

  constructor(private router: Router, private http: HttpClient) {}

  togglePassword(event: Event) {
    event.preventDefault();
    this.showPassword = !this.showPassword;
  }

  // ✅ LOGIN
  onLogin() {
    this.loading = true;
    this.error = '';

    this.http.post('http://localhost:8000/login/', {
      username: this.username,
      password: this.password
    }, { withCredentials: true })
    .subscribe({
      next: () => {
        this.loading = false;

        // optional
        localStorage.setItem('isLoggedIn', 'true');

        // 🚀 FAST NAVIGATION
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.loading = false;
        this.error = 'Invalid username or password';
      }
    });
  }

  goForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }
}