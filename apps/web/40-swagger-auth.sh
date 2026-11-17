#!/bin/sh
# Swagger is closed unless SWAGGER_USER and SWAGGER_PASSWORD are both set.
if [ -n "$SWAGGER_USER" ] && [ -n "$SWAGGER_PASSWORD" ]; then
  printf '%s:{PLAIN}%s\n' "$SWAGGER_USER" "$SWAGGER_PASSWORD" > /etc/nginx/swagger.htpasswd
  printf 'auth_basic "Swagger";\nauth_basic_user_file /etc/nginx/swagger.htpasswd;\n' > /etc/nginx/swagger-auth.conf
else
  printf 'deny all;\n' > /etc/nginx/swagger-auth.conf
fi
