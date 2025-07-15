# GitHub Setup Instructions

After creating your repository on GitHub, run these commands:

## 1. Add Remote Origin
Replace YOUR_USERNAME with your GitHub username:

```bash
cd clients-plus-firebase
git remote add origin https://github.com/YOUR_USERNAME/clients-plus-firebase.git
```

Or if using SSH:
```bash
git remote add origin git@github.com:YOUR_USERNAME/clients-plus-firebase.git
```

## 2. Push to GitHub
```bash
git branch -M main
git push -u origin main
```

## 3. Verify
```bash
git remote -v
git status
```

## Common Issues:

### If you get authentication errors:
1. Create a personal access token: https://github.com/settings/tokens
2. Use the token as your password when prompted

### If you prefer SSH:
1. Generate SSH key: `ssh-keygen -t ed25519 -C "your_email@example.com"`
2. Add to GitHub: https://github.com/settings/keys
3. Test: `ssh -T git@github.com`