import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { Component, ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './signup.html',
  styleUrls: ['./signup.css']
})
export class SignupComponent {

  username = '';
  email = '';
  password = '';
  confirmPassword = '';

  message = '';
  error = '';

  loading = false;

  // 🔥 POPUP STATE
  showPopup = false;
  popupMessage = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private cd: ChangeDetectorRef
  ) {}

  signup() {

    console.log("Signup clicked");

    this.message = '';
    this.error = '';

    // ✅ validation
    if (!this.username || !this.email || !this.password || !this.confirmPassword) {
      this.error = "All fields are required";
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error = "Passwords do not match";
      return;
    }

    if (this.password.length < 6) {
      this.error = "Password must be at least 6 characters";
      return;
    }

    this.loading = true;

    // ✅ API CALL
    this.http.post('http://localhost:8000/signup/', {
      username: this.username,
      email: this.email,
      password: this.password
    }).subscribe({

      next: (res: any) => {
        console.log("SUCCESS:", res);

        this.loading = false;

        // 🔥 SHOW POPUP
        this.popupMessage = "🎉 Account created successfully!";
        this.showPopup = true;

        // 🔥 FORCE UI UPDATE (VERY IMPORTANT)
        this.cd.detectChanges();

        // clear form
        this.username = '';
        this.email = '';
        this.password = '';
        this.confirmPassword = '';

        // 🔥 HIDE POPUP + REDIRECT
        setTimeout(() => {
          this.showPopup = false;
          this.router.navigate(['']);
        }, 1000);
      },

      error: (err) => {
        console.log("ERROR:", err);

        this.loading = false;
        this.error = err.error?.error || "Signup failed";
      }
    });
  }

  goToLogin() {
    this.router.navigate(['']);
  }
}