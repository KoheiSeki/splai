class SplaiError(Exception):
    status_code: int = 500
    type_slug: str = "internal-error"
    title: str = "Internal Server Error"


class GroupNotFound(SplaiError):
    status_code: int = 404
    type_slug: str = "group-not-found"
    title: str = "Group Not Found"


class MemberMismatch(SplaiError):
    status_code: int = 401
    type_slug: str = "member-mismatch"
    title: str = "Member Mismatch"


class RateLimitExceeded(SplaiError):
    status_code: int = 429
    type_slug: str = "rate-limit-exceeded"
    title: str = "Rate Limit Exceeded"


class OCRFailed(SplaiError):
    status_code: int = 502
    type_slug: str = "ocr-failed"
    title: str = "OCR Failed"


class AIProviderError(SplaiError):
    status_code: int = 502
    type_slug: str = "ai-provider-error"
    title: str = "AI Provider Error"


class InvalidPaymentShares(SplaiError):
    status_code: int = 400
    type_slug: str = "invalid-payment-shares"
    title: str = "Invalid Payment Shares"
