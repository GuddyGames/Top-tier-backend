const { createClient } = require('@supabase/supabase-js');

const bucket = process.env.TASK_PROOF_BUCKET || 'task-proofs';

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Task proof storage is not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensureBucket() {
  const supabase = client();
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`Unable to inspect proof storage: ${error.message}`);
  if (!buckets.some((b) => b.name === bucket)) {
    const { error: createError } = await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (createError && !/already exists/i.test(createError.message)) {
      throw new Error(`Unable to create proof bucket: ${createError.message}`);
    }
  }
}

async function uploadProof({ userId, taskId, file }) {
  await ensureBucket();
  const ext = file.mimetype === 'image/jpeg' ? 'jpg' : file.mimetype.split('/')[1];
  const path = `${userId}/${taskId}-${Date.now()}.${ext}`;
  const { error } = await client().storage.from(bucket).upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) throw new Error(`Unable to store proof: ${error.message}`);
  return path;
}

async function createSignedUrl(path, expiresIn = 300) {
  if (!path) return null;
  await ensureBucket();
  const { data, error } = await client().storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw new Error(`Unable to create proof preview: ${error.message}`);
  return data.signedUrl;
}

async function deleteProof(path) {
  if (!path) return;
  await ensureBucket();
  const { error } = await client().storage.from(bucket).remove([path]);
  if (error) throw new Error(`Unable to delete proof: ${error.message}`);
}

module.exports = { ensureBucket, uploadProof, createSignedUrl, deleteProof };
