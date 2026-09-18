// Catches anything passed to next(err), plus thrown errors in async
// route handlers (see utils/asyncHandler.js). Keeps error shape
// consistent for the frontend: { error: "message" }.
function errorHandler(err, req, res, next) {
  console.error(err);

  // Postgres unique-violation (duplicate email/username)
  if (err.code === '23505') {
    return res.status(409).json({ error: 'That username or email is already taken' });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}

module.exports = errorHandler;
