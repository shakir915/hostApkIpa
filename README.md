# https://install4.web.app/


# Host APK/IPA Project

A web application for hosting and sharing Android APK and iOS IPA files.

## Main Pages

### Home Page
- Main landing page for the application
- Displays hosted applications with QR codes for easy download
- Clean, dark-themed interface for better visibility

### Upload Page
- Allows users to upload APK and IPA files to the platform
- Simple interface with file selection and submission
- Automatically processes and hosts mobile application packages

### More Info Page
- Provides detailed information about hosted applications
- Displays application metadata in a readable format
- Features a dark-themed interface with syntax highlighting for JSON data

## Getting Started

### Prerequisites
- Node.js
- Firebase account

### Installation
1. Clone this repository
2. Install dependencies:
   <!-- ```bash -->
   <!-- cd upload-bot -->
   <!-- npm install -->
   <!-- ``` -->
3. Configure Firebase:
   - Update `.firebaserc` with your Firebase project details
   - Review `firebase.json` and `database.rules.json` for configuration

### Usage

1. Start the local server:
   ```bash
   firebase serve
   ```
2. Access the application at `http://localhost:5000`
3. Use the upload functionality to host APK/IPA files

## Deployment

Deploy to Firebase hosting:

```bash
firebase deploy
```

## License

[Add your license information here]

## Contact

[Add your contact information here]