# Build stage (optional if you had a build step; here it's static)
FROM nginx:1.27-alpine
# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy static site
COPY index.html /usr/share/nginx/html/index.html
COPY main.js /usr/share/nginx/html/main.js
EXPOSE 80
# No CMD needed (nginx default)