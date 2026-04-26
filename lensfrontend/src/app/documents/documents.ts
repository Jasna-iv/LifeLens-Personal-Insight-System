import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';

import {
  LucideAngularModule,
  Upload, Eye, Download, Share2, Trash2,
  FileText, File as FileIcon, Maximize, Edit, RotateCcw, Folder, X, Star
} from 'lucide-angular';
// ===== INTERFACE =====
interface DocumentItem {
  id?: number;
  title: string;
  file: string;
  type: 'file' | 'folder';
  uploaded_at: Date;
  folder?: string;
  deleted?: boolean;
  starred?: boolean;
  shared?: boolean;
}

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './documents.html',
  styleUrls: ['./documents.css']
})
export class DocumentsComponent implements OnInit {

  // ===== DATA =====
  allDocuments: DocumentItem[] = [];
  folders: { name: string; type: 'folder' }[] = [];
  viewDocs: any[] = [];

  selectedDoc: DocumentItem | null = null;
  fullscreenDoc: DocumentItem | null = null;

  filter: string = 'all';
  currentFolder: string = '';
  searchText: string = '';

  // ===== UPLOAD / EDIT MODAL =====
  showUpload = false;
  selectedFile: globalThis.File | null = null;
  selectedFolder: string = '';
  newFolder: string = '';
  customFileName: string = '';
  previewUrl: string | null = null;
  safePreviewUrl: SafeResourceUrl | null = null;
  isEditMode = false;
  editingDocId: number | null = null;
  
  // ===== NEW UI STATES =====
    isDragging = false;
    fileExtension = '';
    fileSize = '';
    fileType = '';
  selectedDocs: DocumentItem[] = [];
  selectMode = false;
  // ===== ICONS =====
  readonly Upload = Upload;
  readonly Eye = Eye;
  readonly Download = Download;
  readonly Share2 = Share2;
  readonly Trash2 = Trash2;
  readonly FileText = FileText;
  readonly Folder = Folder;
  readonly Maximize = Maximize;
  readonly Edit = Edit;
  readonly RotateCcw = RotateCcw;
  readonly X = X;
  readonly Star = Star;
  readonly File = FileIcon;

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private cd: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.filter = 'all';
    this.currentFolder = '';
    this.loadDocs();
  }
  private closeAllPanels(): void {
    this.closeUpload();
    this.selectedDoc = null;
    this.fullscreenDoc = null;
  }
  // ================= LOAD DATA =================
  loadDocs(showDeleted: boolean = false): void {
  const url = showDeleted
    ? 'http://127.0.0.1:8000/documents/?deleted=true'
    : 'http://127.0.0.1:8000/documents/';

  this.http.get<any[]>(url).subscribe(res => {

      this.allDocuments = res.map(d => ({
        id: d.id,
        title: d.title || 'Untitled',
        file: d.file || '',
        folder: d.folder || '',
        uploaded_at: new Date(d.uploaded_at),
        type: 'file',
        deleted: d.deleted ?? false,
        shared: d.shared ?? false,
        starred: d.starred ?? false
      }));

      this.folders = Array.from(
        new Set(
          this.allDocuments
            .map(d => d.folder)
            .filter((f): f is string => !!f && f.trim().length > 0)
        )
      ).map(f => ({ name: f, type: 'folder' }));

      this.updateView();
      this.cd.detectChanges();
    });
  }
  // ================= VIEW ENGINE =================
  updateView(): void {
    let docs = [...this.allDocuments];

    if (this.currentFolder) {
      this.viewDocs = docs.filter(d => d.folder === this.currentFolder);
      return;
    }

    if (this.searchText?.trim()) {
      const text = this.searchText.toLowerCase();
      const fileMatch = docs.filter(d => d.title.toLowerCase().includes(text));
      const folderMatch = this.folders.filter(f => f.name.toLowerCase().includes(text));
      this.viewDocs = [...folderMatch, ...fileMatch];
      return;
    }

    switch (this.filter) {
      case 'all':
      const rootFiles = docs.filter(d => !d.folder && !d.deleted);
      this.viewDocs = [...this.folders, ...rootFiles];
      break;
      case 'files': this.viewDocs = docs; break;
      case 'folders': this.viewDocs = this.folders; break;
      case 'shared': this.viewDocs = docs.filter(d => d.shared); break;
      case 'starred': this.viewDocs = docs.filter(d => d.starred); break;
      case 'trash': this.viewDocs = docs.filter(d => d.deleted); break;
      case 'recent':
        this.viewDocs = [...docs].sort((a, b) =>
          new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
        );
        break;
      default: this.viewDocs = docs;
    }
  }

  // ================= FILTER =================
setFilter(type: string): void {
  this.filter = type;
  this.currentFolder = '';
  this.selectedDoc = null;

  if (type === 'trash') {
    this.loadDocs(true);
  } else {
    this.loadDocs(false);
  }
}

  onSearchChange(): void { this.updateView(); }
onNameChange(): void {
  if (!this.customFileName.trim()) {
  }
}
selectDoc(doc: any): void {

  if (doc.deleted) return;

  if (doc.type === 'folder') {
    this.currentFolder = doc.name;
    this.updateView();
    return;
  }

  this.selectedDoc = doc;
}
  closePreview(): void { this.selectedDoc = null; }
  openFullscreen(): void { if (this.selectedDoc) this.fullscreenDoc = this.selectedDoc; }
  closeFullscreen(): void { this.fullscreenDoc = null; }


  // ================= FILE HELPERS =================
  isImage(file: string): boolean { return !!file && /\.(jpg|jpeg|png|gif|webp)$/i.test(file); }
  isPDF(file: string): boolean {
  return file?.toLowerCase().endsWith('.pdf');
}

getSafeUrl(file: string): SafeResourceUrl {
  return this.sanitizer.bypassSecurityTrustResourceUrl(
    file
  );
}

  getFileIcon(file: string): any { if (!file) return this.File; if (/\.pdf$/i.test(file)) return this.FileText; return this.File; }

  // ================= ACTIONS =================
  download(doc: DocumentItem): void { if (doc.file) window.open(doc.file, '_blank'); }

// delete
deleteDoc(doc: DocumentItem): void {

  if (this.selectedDoc?.id === doc.id) {
    this.selectedDoc = null;
  }

  this.allDocuments = this.allDocuments.map(d =>
    d.id === doc.id
      ? { ...d, deleted: true, starred: false } // 🔥 reset star
      : d
  );

  this.updateView();
  this.cd.detectChanges();

  this.http.delete(`http://127.0.0.1:8000/documents/${doc.id}/delete/`)
    .subscribe({
      error: err => {
        console.error('Delete failed', err);

        this.allDocuments = this.allDocuments.map(d =>
          d.id === doc.id ? { ...d, deleted: false } : d
        );
        this.updateView();
      }
    });
}

// restore
restoreDoc(doc: DocumentItem): void {
  this.allDocuments = this.allDocuments.map(d =>
    d.id === doc.id ? { ...d, deleted: false } : d
  );

  this.updateView();
  this.cd.detectChanges();

  this.http.put(`http://127.0.0.1:8000/documents/${doc.id}/restore/`, {})
    .subscribe({
      error: err => {
        console.error('Restore failed', err);

        // rollback
        this.allDocuments = this.allDocuments.map(d =>
          d.id === doc.id ? { ...d, deleted: true } : d
        );
        this.updateView();
      }
    });
}
// permenant
permanentDelete(doc: DocumentItem): void {
  const original = [...this.allDocuments];

  // instant remove
  this.allDocuments = this.allDocuments.filter(d => d.id !== doc.id);

  this.updateView();
  this.cd.detectChanges();

  this.http.delete(`http://127.0.0.1:8000/documents/${doc.id}/permanent/`)
    .subscribe({
      error: err => {
        console.error('Permanent delete failed', err);

        // rollback if error
        this.allDocuments = original;
        this.updateView();
      }
    });
}

confirmPermanentDelete(doc: DocumentItem): void {
  const ok = confirm('⚠️ This will permanently delete the file. This action cannot be undone. Continue?');

  if (!ok) return;

  this.permanentDelete(doc);
}
toggleSelect(doc: DocumentItem) {
  const exists = this.selectedDocs.find(d => d.id === doc.id);

  if (exists) {
    this.selectedDocs = this.selectedDocs.filter(d => d.id !== doc.id);
  } else {
    this.selectedDocs.push(doc);
  }
}
selectAllTrash() {
  const trashDocs = this.allDocuments.filter(d => d.deleted);

  if (this.areAllTrashSelected()) {
    // ✅ UNSELECT instantly
    this.selectedDocs = [];
  } else {
    // ✅ SELECT all
    this.selectedDocs = [...trashDocs];
  }
}
areAllTrashSelected(): boolean {
  const trashDocs = this.allDocuments.filter(d => d.deleted);

  return (
    trashDocs.length > 0 &&
    trashDocs.every(doc =>
      this.selectedDocs.some(s => s.id === doc.id)
    )
  );
}
deleteSelectedPermanently() {
  const ok = confirm('Delete selected files permanently?');

  if (!ok) return;

  const ids = this.selectedDocs.map(d => d.id);

  // UI instant remove
  this.allDocuments = this.allDocuments.filter(d => !ids.includes(d.id));

  this.updateView();

  // API calls
  ids.forEach(id => {
    this.http.delete(`http://127.0.0.1:8000/documents/${id}/permanent/`)
      .subscribe({
        error: err => console.error('Delete failed for', id, err)
      });
  });

  this.selectedDocs = [];
}
// share
async share(doc: DocumentItem): Promise<void> {
  try {
    if (!doc.file) {
      alert('No file to share');
      return;
    }

    // 🔹 Fetch file
    const response = await fetch(doc.file);
    const blob = await response.blob();

    // 🔹 Create real file object
    const file = new globalThis.File(
      [blob],
      doc.title || 'file',
      { type: blob.type || 'application/octet-stream' }
    );

    let shared = false;

    // 🔹 Try file sharing (best experience)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: doc.title,
        files: [file]
      });
      shared = true;
    } else if (navigator.share) {
      // 🔹 Fallback: share link
      await navigator.share({
        title: doc.title,
        url: doc.file
      });
      shared = true;
    } else {
      // 🔹 Final fallback: copy link
      await navigator.clipboard.writeText(doc.file);
      alert('Link copied! Share manually.');
      shared = true;
    }

    // 🔹 Update UI only if share happened
    if (shared) {
      doc.shared = true;
      this.updateView();

      // 🔹 Sync with backend (optional but recommended)
      try {
        await this.http
          .put(`http://127.0.0.1:8000/documents/${doc.id}/share/`, {})
          .toPromise();
      } catch (err) {
        console.warn('Backend share update failed', err);
      }
    }

  } catch (err) {
    console.error('Share failed', err);
    alert('Sharing failed. Try again.');
  }
}
removeFromShared(doc: DocumentItem) {
  // ✅ Remove from shared section only
  doc.shared = false;

  // ✅ Refresh UI
  this.updateView();

  // ✅ OPTIONAL backend sync
  this.http
    .put(`http://127.0.0.1:8000/documents/${doc.id}/unshare/`, {})
    .subscribe({
      error: (err) => console.error('Unshare failed', err)
    });
}
// toggle
toggleStar(doc: DocumentItem): void {
  this.http.put(`http://127.0.0.1:8000/documents/${doc.id}/star/`, {})
    .subscribe({
      next: () => {
        this.loadDocs();  
      },
      error: err => console.error('Star failed', err)
    });
}

  // ================= EDIT MODE =================
startEdit(doc: DocumentItem): void {
  this.isEditMode = true;
  this.showUpload = true;
  this.editingDocId = doc.id || null;

  this.customFileName = doc.title;
  this.selectedFolder = doc.folder || '';

  this.selectedFile = null;

  this.previewUrl = doc.file || null;

  if (doc.file) {
    this.safePreviewUrl =
      this.sanitizer.bypassSecurityTrustResourceUrl(doc.file);
  } else {
    this.safePreviewUrl = null;
  }

  if (this.isPDF(doc.file)) {
    this.fileType = 'PDF';
  } else if (this.isImage(doc.file)) {
    this.fileType = 'Image';
  } else {
    this.fileType = 'File';
  }
}

  async upload(): Promise<void> {
    if (!this.customFileName || !this.customFileName.trim()) return;

    const formData = new FormData();
    formData.append('title', this.customFileName + '.' + this.fileExtension);
    formData.append('folder', this.newFolder || this.selectedFolder || '');

    if (this.isEditMode && this.editingDocId != null) {
      if (this.selectedFile) formData.append('file', this.selectedFile);
      this.http.put(`http://127.0.0.1:8000/documents/${this.editingDocId}/edit/`, formData)
  .subscribe({
    next: () => {
      this.loadDocs();
      this.closeAllPanels();

      // ✅ CLOSE SIDE PREVIEW AFTER SAVE
      this.selectedDoc = null;
    },
    error: err => console.error('Edit failed', err)
  });
      return;
    }

    if (!this.selectedFile) return;
    formData.append('file', this.selectedFile);
    this.http.post('http://127.0.0.1:8000/upload/', formData)
      .subscribe({ next: () => { this.loadDocs(); this.closeUpload(); }, error: err => console.error('Upload failed', err) });
  }

  openUpload(): void { this.showUpload = true; }
  closeUpload(): void {
    this.showUpload = false;
    this.isEditMode = false;
    this.editingDocId = null;
    this.selectedFile = null;
    this.previewUrl = null;
    this.newFolder = '';
    this.customFileName = '';
    this.selectedFolder = '';
  }
  onDragOver(event: DragEvent): void {
  event.preventDefault();
  this.isDragging = true;
}

onDragLeave(event: DragEvent): void {
  event.preventDefault();
  this.isDragging = false;
}

onDrop(event: DragEvent): void {
  event.preventDefault();
  this.isDragging = false;

  const file = event.dataTransfer?.files?.[0];
  if (!file) return;

  this.handleFile(file);
}

 onFileSelected(event: any): void {
  const file = event.target.files?.[0];
  if (!file) return;

  this.handleFile(file);
}

handleFile(file: File): void {
  this.selectedFile = file;

  this.customFileName = file.name.replace(/\.[^/.]+$/, "");
  this.fileExtension = file.name.split('.').pop() || '';
  this.fileSize = (file.size / 1024).toFixed(2) + ' KB';

  if (file.type.startsWith('image')) this.fileType = 'Image';
  else if (file.type.includes('pdf')) this.fileType = 'PDF';
  else this.fileType = 'File';

  this.previewUrl = URL.createObjectURL(file);
  this.safePreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.previewUrl);

  this.cd.detectChanges();
}

getSelectedPreviewUrl(): SafeResourceUrl | string | null {
  if (!this.selectedDoc?.file) return null;

  const url = this.selectedDoc.file;

  if (this.isPDF(url) || url.toLowerCase().includes('.pdf')) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  if (this.isImage(url)) {
    return url;
  }

  // fallback for other files
  return url;
}

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  goToTasks() {
    this.router.navigate(['/tasks']);
  }
  goToExpenses() {
    this.router.navigate(['/expenses']);
  }
    goToInsights() {
    this.router.navigate(['/insights']);
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }

  logout() {
    this.router.navigate(['']);
  }
}