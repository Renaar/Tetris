# Image légère : un simple serveur web nginx qui sert les fichiers statiques du jeu.
FROM nginx:1.27-alpine

# Configuration nginx (cache, compression)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Fichiers du jeu
COPY public/ /usr/share/nginx/html/

EXPOSE 80
