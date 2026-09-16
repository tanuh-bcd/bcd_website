# # Multi-stage Dockerfile for building and serving the Vite React app with Apache HTTPD

# # 1) Builder stage: install deps and build
# FROM node:20-alpine AS builder
# WORKDIR /app

# # Install dependencies first (better cache)
# COPY package.json package-lock.json ./
# RUN npm ci --no-audit --no-fund

# # Copy source and build
# COPY . .
# RUN npm run build

# # 2) Runtime stage: Apache HTTPD serving static files
# FROM httpd:2.4-alpine AS runtime

# # Enable SPA routing via .htaccess by allowing overrides and enabling mod_rewrite
# # - Un-comment (or add) the rewrite module
# # - Allow .htaccess overrides in the DocumentRoot
# RUN sed -i 's%^#\?LoadModule rewrite_module modules/mod_rewrite.so%LoadModule rewrite_module modules/mod_rewrite.so%' /usr/local/apache2/conf/httpd.conf \
#   && sed -i 's/AllowOverride None/AllowOverride All/i' /usr/local/apache2/conf/httpd.conf \
#   && echo "ServerName localhost" >> /usr/local/apache2/conf/httpd.conf \
#   && echo "Include conf/extra/logfilter.conf" >> /usr/local/apache2/conf/httpd.conf

# # Copy Apache log filter to exclude docker healthcheck noise
# COPY apache/logfilter.conf /usr/local/apache2/conf/extra/logfilter.conf

# # Copy built assets to Apache's document root
# COPY --from=builder /app/dist/ /usr/local/apache2/htdocs/

# # Add .htaccess for SPA fallback (rewrite non-file requests to /index.html)
# COPY apache.htaccess /usr/local/apache2/htdocs/.htaccess

# EXPOSE 80

# # Healthcheck: use a HEAD-like probe and tag with a unique User-Agent; quiet output
# HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider -U docker-healthcheck http://127.0.0.1/ || exit 1

# # Start Apache in the foreground
# CMD ["httpd-foreground"]




# # 1️⃣ Builder stage: install deps and build
# FROM node:20-alpine AS builder
# WORKDIR /app

# # Install dependencies first for caching
# COPY package.json package-lock.json ./
# RUN npm ci --no-audit --no-fund

# # Copy the rest of the frontend source and build
# COPY . .
# RUN npm run build

# # 2️⃣ Runtime stage: Apache HTTPD serving static files
# FROM httpd:2.4-alpine AS runtime

# # Enable .htaccess and rewrite module for SPA routing
# RUN sed -i 's%^#\?LoadModule rewrite_module modules/mod_rewrite.so%LoadModule rewrite_module modules/mod_rewrite.so%' /usr/local/apache2/conf/httpd.conf \
#   && sed -i 's/AllowOverride None/AllowOverride All/i' /usr/local/apache2/conf/httpd.conf \
#   && echo "ServerName localhost" >> /usr/local/apache2/conf/httpd.conf \
#   && echo "Include conf/extra/logfilter.conf" >> /usr/local/apache2/conf/httpd.conf

# # Optional: custom log filter to reduce noise (if exists)
# COPY apache/logfilter.conf /usr/local/apache2/conf/extra/logfilter.conf

# # ✅ Copy Vite build output to Apache document root
# COPY --from=builder /app/dist/ /usr/local/apache2/htdocs/

# # Optional: SPA fallback (non-file routes → index.html)
# COPY apache.htaccess /usr/local/apache2/htdocs/.htaccess

# EXPOSE 80

# HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider -U docker-healthcheck http://127.0.0.1/ || exit 1

# CMD ["httpd-foreground"]


# 1️⃣ Builder stage: install deps and build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ARG VITE_API_URL
ARG VITE_QUESTIONNAIRE_VERSION
ARG SKIP_FETCH=1

# ✅ Set environment variables for the build
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_QUESTIONNAIRE_VERSION=${VITE_QUESTIONNAIRE_VERSION}
ENV SKIP_FETCH=${SKIP_FETCH}

# ✅ Build the frontend, skipping DB fetch during Docker build
RUN SKIP_FETCH=1 VITE_API_URL=$VITE_API_URL npm run build

# 2️⃣ Runtime stage
FROM httpd:2.4-alpine AS runtime

RUN sed -i 's%^#\?LoadModule rewrite_module modules/mod_rewrite.so%LoadModule rewrite_module modules/mod_rewrite.so%' /usr/local/apache2/conf/httpd.conf \
  && sed -i 's%^#\?LoadModule headers_module modules/mod_headers.so%LoadModule headers_module modules/mod_headers.so%' /usr/local/apache2/conf/httpd.conf \
  && sed -i 's%^#\?LoadModule proxy_module modules/mod_proxy.so%LoadModule proxy_module modules/mod_proxy.so%' /usr/local/apache2/conf/httpd.conf \
  && sed -i 's%^#\?LoadModule proxy_http_module modules/mod_proxy_http.so%LoadModule proxy_http_module modules/mod_proxy_http.so%' /usr/local/apache2/conf/httpd.conf \
  && sed -i 's/AllowOverride None/AllowOverride All/i' /usr/local/apache2/conf/httpd.conf \
  && echo "ServerName localhost" >> /usr/local/apache2/conf/httpd.conf \
  && echo "Include conf/extra/logfilter.conf" >> /usr/local/apache2/conf/httpd.conf

COPY apache/logfilter.conf /usr/local/apache2/conf/extra/logfilter.conf
COPY --from=builder /app/dist/ /usr/local/apache2/htdocs/
COPY apache.htaccess /usr/local/apache2/htdocs/.htaccess

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider -U docker-healthcheck http://127.0.0.1/ || exit 1
CMD ["httpd-foreground"]
