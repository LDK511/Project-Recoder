// 간단한 사용자 인증 미들웨어
// JWT 또는 세션 기반 인증을 위한 기본 구조

const auth = (req, res, next) => {
  // 요청 헤더에서 토큰 추출
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    // 토큰이 없으면 임시 사용자 ID 할당 (데모용)
    req.userId = req.headers['x-user-id'] || 'guest-' + Date.now();
    return next();
  }
  
  try {
    // 토큰 검증 (실제 구현에서는 JWT 검증)
    req.userId = token;
    next();
  } catch (error) {
    res.status(401).json({ error: '인증 실패' });
  }
};

module.exports = auth;
