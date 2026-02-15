#!/bin/bash

# Generate SSL certificates for localhost development
# First, install mkcert if you haven't already: brew install mkcert

mkcert -install && mkcert -key-file .netlify/localhost-key.pem -cert-file .netlify/localhost-cert.pem localhost 127.0.0.1 ::1
