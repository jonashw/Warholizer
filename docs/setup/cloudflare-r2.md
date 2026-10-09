# Setting up Cloudflare R2 for image storage

[ADR 0001](../adr/0001-cloud-storage-for-images-and-formulas.md) stores image bytes in Cloudflare R2 (metadata stays in Neon). Browsers upload directly to R2 through short-lived presigned URLs issued by a Netlify function, so full-size phone photos never pass through a function's payload limit.

## 1. Create the bucket

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com) (create a free account if needed).
2. In the sidebar, open **R2 Object Storage**. The first time, Cloudflare asks you to enable R2 (it may ask for a payment method; the free tier covers 10 GB and has no egress fees).
3. **Create bucket**, name it `warholizer-images`, location **Automatic**. Leave public access off: images are served through signed URLs.

## 2. Allow browser uploads (CORS)

In the bucket: **Settings → CORS policy → Add CORS policy**, and paste:

```json
[
  {
    "AllowedOrigins": ["https://warholizer.jonashw.dev", "http://localhost:5173", "https://localhost:8888"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## 3. Create an API token

1. Back on the R2 overview page: **Manage R2 API Tokens** (or **API → Manage API tokens**) → **Create API token**.
2. Permissions: **Object Read & Write**. Bucket scope: **Apply to specific buckets only** → `warholizer-images`. TTL: forever.
3. Create it and copy, from the page shown once:
   - **Access Key ID**
   - **Secret Access Key**
   - The **S3 endpoint** for your account: `https://<account-id>.r2.cloudflarestorage.com`

## 4. Give the keys to Netlify

In Netlify: **Site configuration → Environment variables → Add a variable** (as for `ADMIN_EMAILS`), scoped to Functions:

| Key | Value |
|---|---|
| `R2_ACCESS_KEY_ID` | the Access Key ID |
| `R2_SECRET_ACCESS_KEY` | the Secret Access Key (mark it secret) |
| `R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | `warholizer-images` |

For local development with `netlify dev`, the same variables are pulled from Netlify automatically.

Until these exist, the server falls back to Netlify Blobs behind the same `ImageStore` interface, so nothing is blocked.
