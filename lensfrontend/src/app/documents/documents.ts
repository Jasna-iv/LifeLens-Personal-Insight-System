import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './documents.html',
  styleUrls: ['./documents.css']
})
export class DocumentsComponent implements OnInit {

  documents: any[] = [];
  filterType = '';

  title = '';
  doc_type = '';
  file!: File;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadDocs();
  }

  // ================= LOAD =================
  loadDocs() {
    this.http.get(
  'http://localhost:8000/documents/',
  { withCredentials: true }
).subscribe((res: any) => {
      this.documents = res;
    });
  }

  // ================= FILE SELECT =================
onFileChange(event: any) {
  const file = event.target.files[0];

  if (!file) return;

  this.file = file;
}
  // ================= UPLOAD =================
upload() {

  if (!this.title || !this.doc_type || !this.file) {
    alert("Please fill all fields + select file");
    return;
  }

  const formData = new FormData();

  formData.append('title', this.title);
  formData.append('doc_type', this.doc_type);
  formData.append('file', this.file);

  console.log("Uploading file:", this.file); // DEBUG

  this.http.post(
  'http://localhost:8000/documents/upload/',
  formData,
  {
    withCredentials: true,
    headers: {
      // DO NOT set Content-Type manually (VERY IMPORTANT)
    }
  }
).subscribe({
    next: (res: any) => {

      console.log("UPLOAD SUCCESS", res);

      this.title = '';
      this.doc_type = '';
      this.file = null as any;

      this.loadDocs();
    },

    error: (err) => {
  console.log("UPLOAD ERROR FULL:", err);
  console.log("STATUS:", err.status);
  console.log("ERROR BODY:", err.error);

  alert(err.error?.error || "Upload failed");
}
  });
}
  // ================= DOWNLOAD =================
download(file: string) {
  window.open('http://localhost:8000' + file, '_blank');
}
filteredDocs() {
  if (!this.filterType) return this.documents;
  return this.documents.filter(d => d.type === this.filterType);
}
}