import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.connectors.ashby import sync_ashby_jobs
from app.connectors.greenhouse import sync_greenhouse_jobs
from app.connectors.lever import sync_lever_jobs
from app.models import Company

SUPPORTED_SOURCE_TYPES = frozenset({"ashby", "greenhouse", "lever"})
SAFE_SYNC_FAILURE_MESSAGE = "The source could not be synchronized. Please try again later."


class SourceNotSynchronizableError(ValueError):
    pass


@dataclass(frozen=True)
class SourceSyncResult:
    status: str
    jobs_created: int | None = None
    jobs_updated: int | None = None
    message: str | None = None


def sync_configured_source(
    *,
    db: Session,
    source: Company,
    owner_id: uuid.UUID,
) -> SourceSyncResult:
    if source.user_id != owner_id:
        raise SourceNotSynchronizableError("Source is not available for synchronization")
    if source.source_type not in SUPPORTED_SOURCE_TYPES:
        raise SourceNotSynchronizableError("Source type is not supported for synchronization")
    if not source.active or not source.board_token:
        raise SourceNotSynchronizableError("Source is not configured for synchronization")

    sync_functions = {
        "ashby": sync_ashby_jobs,
        "greenhouse": sync_greenhouse_jobs,
        "lever": sync_lever_jobs,
    }

    try:
        result = sync_functions[source.source_type](
            db,
            source.board_token,
            source.name,
            company=source,
        )
    except Exception:
        db.rollback()
        return SourceSyncResult(status="failed", message=SAFE_SYNC_FAILURE_MESSAGE)

    return SourceSyncResult(
        status="synced",
        jobs_created=result["created"],
        jobs_updated=result["skipped"],
    )
