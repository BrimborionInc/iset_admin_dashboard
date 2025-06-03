# Stop script on any error
$ErrorActionPreference = "Stop"

# Build production version of the React app
Write-Host "Building production version..."
npm run build:production

# Copy necessary files to EC2
Write-Host "Copying files to EC2..."
scp -i "c:\mykeypair.pem" `
  -r "X:\ISET\admin-dashboard\build\*" `
     "X:\ISET\admin-dashboard\isetadminserver.js" `
     "X:\ISET\admin-dashboard\package.json" `
     "X:\ISET\admin-dashboard\package-lock.json" `
     "X:\ISET\admin-dashboard\.env.production" `
     "X:\ISET\admin-dashboard\src\utils\utils.js" `
     "X:\ISET\admin-dashboard\blocksteps" `
     "X:\ISET\admin-dashboard\templates" `
  ec2-user@3.97.19.252:/home/ec2-user/admin-dashboard/

# Connect to EC2 and deploy
Write-Host "Connecting to EC2 and deploying..."
ssh -i "c:\mykeypair.pem" ec2-user@3.97.19.252 '
  mkdir -p /home/ec2-user/admin-dashboard/src/utils &&
  mv -f /home/ec2-user/admin-dashboard/utils.js /home/ec2-user/admin-dashboard/src/utils/utils.js &&
  sudo rm -rf /usr/share/nginx/html/* &&
  sudo cp -r /home/ec2-user/admin-dashboard/index.html /usr/share/nginx/html/ &&
  sudo cp -r /home/ec2-user/admin-dashboard/static /usr/share/nginx/html/ &&
  sudo cp -r /home/ec2-user/admin-dashboard/asset-manifest.json /usr/share/nginx/html/ &&
  sudo cp -r /home/ec2-user/admin-dashboard/favicon.ico /usr/share/nginx/html/ &&
  sudo cp -r /home/ec2-user/admin-dashboard/manifest.json /usr/share/nginx/html/ &&
  sudo cp -r /home/ec2-user/admin-dashboard/robots.txt /usr/share/nginx/html/ &&
  cp -f /home/ec2-user/admin-dashboard/.env.production /home/ec2-user/admin-dashboard/.env &&
  sudo mkdir -p /home/ec2-user/admin-dashboard/blocksteps &&
  sudo cp -ru /home/ec2-user/admin-dashboard/blocksteps/* /home/ec2-user/admin-dashboard/blocksteps/ &&
  sudo mkdir -p /home/ec2-user/admin-dashboard/templates &&
  sudo cp -ru /home/ec2-user/admin-dashboard/templates/* /home/ec2-user/admin-dashboard/templates/ &&
  sudo systemctl restart nginx &&
  (pm2 restart admin-dashboard || pm2 start /home/ec2-user/admin-dashboard/isetadminserver.js --name admin-dashboard) &&
  echo "Deployment complete!"
'
