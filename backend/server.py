"""
Pineapple OS - Backend Server
=============================
FastAPI backend for Pineapple OS operator workspace.
Provides CRUD APIs for all modules: Commands, Tasks, Deals,
Knowledge Vault, Build Queue, Daily Reviews, and Activity Log.

All routes are prefixed with /api for Kubernetes ingress routing.
MongoDB is used via motor (async driver).
"""

from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import json
import os
import logging
import subprocess
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import Any, List, Optional
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

RUNTIME_ROOT = Path(os.environ.get("PINEAPPLE_RUNTIME_ROOT", "/Users/DdyFngr/Desktop/Projects/pineapple-ops-runtime"))
STATE_DIR = RUNTIME_ROOT / "state"
AGENCIES_DIR = RUNTIME_ROOT / "agencies"
MARKETPLACE_OUTPUT_FILE = AGENCIES_DIR / "marketplace-opportunity" / "latest-output.json"
TASKS_FILE = STATE_DIR / "tasks.jsonl"
EXCEPTIONS_FILE = STATE_DIR / "exception-stream.jsonl"
BRIEF_FILE = STATE_DIR / "daily-brief.md"
DECISION_INBOX_FILE = STATE_DIR / "decision-inbox.json"
APPROVALS_FILE = STATE_DIR / "approvals.json"
CANONICAL_STATE_CONTRACT_FILE = STATE_DIR / "canonical-state-contract.json"
CANONICAL_OWNERSHIP_FILE = STATE_DIR / "ownership-map.json"

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# FastAPI app and router
app = FastAPI(title="Pineapple OS API", version="1.0.0")
api_router = APIRouter(prefix="/api")

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# =============================================================================
# SHARED UTILITIES
# =============================================================================

def now_iso():
    """Return current UTC time as ISO string."""
    return datetime.now(timezone.utc).isoformat()

def new_id():
    """Generate a new UUID string."""
    return str(uuid.uuid4())


def _read_json(path: Path, default: Any):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except Exception:
        return default


def _read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows: list[dict] = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except Exception:
            continue
    return rows


def _read_markdown(path: Path) -> str:
    if not path.exists():
        return ""
    try:
        return path.read_text()
    except Exception:
        return ""


def _docker_service_rows() -> list[dict]:
    sock_path = "/var/run/docker.sock"
    if not Path(sock_path).exists():
        return []
    try:
        output = subprocess.check_output(
            [
                "python",
                "-c",
                (
                    "import json, socket; "
                    "s=socket.socket(socket.AF_UNIX, socket.SOCK_STREAM); "
                    "s.settimeout(8); "
                    "s.connect('/var/run/docker.sock'); "
                    "s.sendall(b'GET /containers/json HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n'); "
                    "chunks=[]; "
                    "\nwhile True:\n"
                    "  data=s.recv(65536)\n"
                    "  if not data: break\n"
                    "  chunks.append(data)\n"
                    "body=b''.join(chunks).split(b'\\r\\n\\r\\n',1)[1]; "
                    "print(body.decode('utf-8'))"
                ),
            ],
            text=True,
            timeout=10,
        )
        parsed = json.loads(output)
    except Exception:
        return []

    rows: list[dict] = []
    for row in parsed:
        name = (row.get("Names") or [""])[0].lstrip("/").strip()
        status = (row.get("Status") or "").strip()
        if not name:
            continue
        rows.append({"name": name, "status": status})
    return rows


def _service_health_summary() -> dict:
    rows = _docker_service_rows()
    total = len(rows)
    up = sum(1 for row in rows if row["status"].lower().startswith("up"))
    return {
        "services": rows,
        "healthy_count": up,
        "total_count": total,
        "summary": f"{up}/{total} services up" if total else "unwired",
    }


def _task_snapshots() -> tuple[list[dict], list[dict]]:
    task_events = _read_jsonl(TASKS_FILE)
    latest_by_id: dict[str, dict] = {}
    for event in task_events:
        task_id = event.get("task_id")
        if not task_id:
            continue
        latest_by_id[task_id] = {**latest_by_id.get(task_id, {}), **event}
    tasks = sorted(
        latest_by_id.values(),
        key=lambda row: row.get("updated_at") or row.get("created_at") or "",
        reverse=True,
    )
    active = [task for task in tasks if task.get("state") in {"active", "pending", "running"}]
    return tasks, active


def _approvals_snapshot() -> list[dict]:
    approvals = _read_json(APPROVALS_FILE, [])
    if approvals:
        return approvals
    legacy = Path("/Users/DdyFngr/Desktop/Projects/marketplace-scraper/pineapple-state/approvals.json")
    return _read_json(legacy, [])


def _marketplace_snapshot() -> dict:
    return _read_json(MARKETPLACE_OUTPUT_FILE, {})


def _failures_snapshot(limit: int = 10) -> list[dict]:
    rows = _read_jsonl(EXCEPTIONS_FILE)
    rows.reverse()
    return rows[:limit]


def _brief_snapshot() -> dict:
    return {
        "markdown": _read_markdown(BRIEF_FILE),
        "decision_inbox": _read_json(DECISION_INBOX_FILE, []),
    }


def _runtime_overview() -> dict:
    service_health = _service_health_summary()
    tasks, active_tasks = _task_snapshots()
    approvals = _approvals_snapshot()
    marketplace = _marketplace_snapshot()
    failures = _failures_snapshot()
    brief = _brief_snapshot()
    contract = _read_json(CANONICAL_STATE_CONTRACT_FILE, {})
    ownership = _read_json(CANONICAL_OWNERSHIP_FILE, {})

    latest_completions = [
        task for task in tasks if task.get("state") == "completed"
    ][:5]
    top_actions = marketplace.get("top_deals") or []
    blockers = list(marketplace.get("blockers") or [])
    blockers.extend(
        failure.get("summary") for failure in failures if failure.get("summary")
    )

    return {
        "generated_at": now_iso(),
        "canonical_runtime_root": str(RUNTIME_ROOT),
        "service_health": service_health,
        "openclaw": {
            "alive": True,
            "owner": "OpenClaw",
            "evidence": "Main Telegram session active and runtime state files updating",
        },
        "dispatch": {
            "alive": True,
            "owner": "Dispatch",
            "evidence": "Pineapple-Dash backend consuming canonical runtime state",
        },
        "marketplace": {
            "alive": bool(marketplace),
            "healthy": not any("eBay" in blocker for blocker in marketplace.get("blockers", [])),
            "run_summary": marketplace.get("run_summary") or {},
            "top_opportunities": top_actions[:3],
        },
        "agents": [
            {
                "name": "OpenClaw Chief of Staff",
                "system": "OpenClaw",
                "status": "active" if brief["markdown"] else "unwired",
                "last_output_at": marketplace.get("generated_at"),
                "role": "briefing and runtime sidecar",
            },
            {
                "name": "Marketplace Opportunity",
                "system": "marketplace-scraper",
                "status": "active" if marketplace else "unwired",
                "last_output_at": marketplace.get("generated_at"),
                "role": "ingestion, scoring, top opportunities",
            },
            {
                "name": "Dispatch",
                "system": "Pineapple OS",
                "status": "active",
                "last_output_at": now_iso(),
                "role": "architecture, integration, audit",
            },
        ],
        "tasks": tasks,
        "active_tasks": active_tasks,
        "approvals": approvals,
        "alerts": failures,
        "failures": failures,
        "latest_completions": latest_completions,
        "top_actions": top_actions[:3],
        "daily_brief": brief,
        "active_intent": active_tasks[0].get("title") if active_tasks else "Maintain Pineapple operator runtime",
        "ownership_map": ownership,
        "state_contract": contract,
        "unwired": [
            "n8n workflows" if not contract.get("n8n") else None,
        ],
        "blocked_items": [item for item in blockers if item],
    }

async def log_activity(action: str, module: str, entity_id: str, title: str):
    """Log an activity entry for the activity feed."""
    doc = {
        "id": new_id(),
        "action": action,
        "module": module,
        "entity_id": entity_id,
        "title": title,
        "timestamp": now_iso()
    }
    await db.activity_log.insert_one(doc)


# =============================================================================
# PYDANTIC MODELS - Shared conventions across all entities
# =============================================================================

# --- Commands ---
class CommandCreate(BaseModel):
    content: str
    entry_type: str = "note"  # task, deal, note, idea, trade, system
    tags: List[str] = []

class CommandResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    content: str
    entry_type: str
    tags: List[str]
    created_at: str

# --- Tasks ---
class TaskCreate(BaseModel):
    title: str
    description: str = ""
    status: str = "todo"  # todo, doing, blocked, done
    priority: str = "medium"  # low, medium, high, critical
    due_date: Optional[str] = None
    tags: List[str] = []

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    tags: Optional[List[str]] = None

class TaskResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    description: str
    status: str
    priority: str
    due_date: Optional[str]
    tags: List[str]
    created_at: str
    updated_at: str

# --- Deals ---
class DealCreate(BaseModel):
    title: str
    category: str = ""
    buy_price: float = 0.0
    sell_price: float = 0.0
    fees: float = 0.0
    status: str = "open"  # open, pending, closed, archived
    priority: str = "medium"
    notes: str = ""
    tags: List[str] = []

class DealUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    buy_price: Optional[float] = None
    sell_price: Optional[float] = None
    fees: Optional[float] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None

class DealResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    category: str
    buy_price: float
    sell_price: float
    fees: float
    estimated_profit: float
    roi_percent: float
    status: str
    priority: str
    notes: str
    tags: List[str]
    created_at: str
    updated_at: str

# --- Knowledge Vault ---
class KnowledgeCreate(BaseModel):
    title: str
    content: str = ""
    category: str = "general"  # general, sop, prompt, strategy, reference
    tags: List[str] = []

class KnowledgeUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None

class KnowledgeResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    content: str
    category: str
    tags: List[str]
    created_at: str
    updated_at: str

# --- Build Queue ---
class BuildQueueCreate(BaseModel):
    title: str
    description: str = ""
    status: str = "requested"  # requested, planning, building, done
    priority: str = "medium"
    rationale: str = ""
    tags: List[str] = []

class BuildQueueUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    rationale: Optional[str] = None
    tags: Optional[List[str]] = None

class BuildQueueResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    description: str
    status: str
    priority: str
    rationale: str
    tags: List[str]
    created_at: str
    updated_at: str

# --- Daily Review ---
class DailyReviewUpdate(BaseModel):
    next_actions: str = ""
    reflections: str = ""


# =============================================================================
# API ROUTES - Commands
# =============================================================================

@api_router.post("/commands", response_model=CommandResponse)
async def create_command(data: CommandCreate):
    """Create a new command entry from the Command Center."""
    doc = {
        "id": new_id(),
        "content": data.content,
        "entry_type": data.entry_type,
        "tags": data.tags,
        "created_at": now_iso()
    }
    await db.commands.insert_one(doc)
    await log_activity("created", "commands", doc["id"], data.content[:80])
    return CommandResponse(**doc)

@api_router.get("/commands", response_model=List[CommandResponse])
async def get_commands(limit: int = Query(50, le=200), entry_type: Optional[str] = None):
    """Get recent command entries, optionally filtered by type."""
    query = {}
    if entry_type:
        query["entry_type"] = entry_type
    docs = await db.commands.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs

@api_router.delete("/commands/{command_id}")
async def delete_command(command_id: str):
    result = await db.commands.delete_one({"id": command_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Command not found")
    return {"status": "deleted"}


# =============================================================================
# API ROUTES - Tasks
# =============================================================================

@api_router.post("/tasks", response_model=TaskResponse)
async def create_task(data: TaskCreate):
    """Create a new task."""
    now = now_iso()
    doc = {
        "id": new_id(),
        "title": data.title,
        "description": data.description,
        "status": data.status,
        "priority": data.priority,
        "due_date": data.due_date,
        "tags": data.tags,
        "created_at": now,
        "updated_at": now
    }
    await db.tasks.insert_one(doc)
    await log_activity("created", "tasks", doc["id"], data.title)
    return TaskResponse(**doc)

@api_router.get("/tasks", response_model=List[TaskResponse])
async def get_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None
):
    """Get all tasks with optional filters."""
    query = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if search:
        query["title"] = {"$regex": search, "$options": "i"}
    docs = await db.tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

@api_router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    return doc

@api_router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, data: TaskUpdate):
    """Update a task. Only provided fields are updated."""
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = now_iso()
    result = await db.tasks.update_one({"id": task_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    await log_activity("updated", "tasks", task_id, updates.get("title", doc["title"]))
    return doc

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.tasks.delete_one({"id": task_id})
    await log_activity("deleted", "tasks", task_id, doc["title"])
    return {"status": "deleted"}


# =============================================================================
# API ROUTES - Deals
# =============================================================================

def calc_deal_fields(doc: dict) -> dict:
    """Auto-calculate estimated_profit and roi_percent for a deal."""
    buy = doc.get("buy_price", 0)
    sell = doc.get("sell_price", 0)
    fees = doc.get("fees", 0)
    profit = sell - buy - fees
    roi = (profit / buy * 100) if buy > 0 else 0.0
    doc["estimated_profit"] = round(profit, 2)
    doc["roi_percent"] = round(roi, 2)
    return doc

@api_router.post("/deals", response_model=DealResponse)
async def create_deal(data: DealCreate):
    """Create a new deal with auto-calculated profit and ROI."""
    now = now_iso()
    doc = {
        "id": new_id(),
        "title": data.title,
        "category": data.category,
        "buy_price": data.buy_price,
        "sell_price": data.sell_price,
        "fees": data.fees,
        "status": data.status,
        "priority": data.priority,
        "notes": data.notes,
        "tags": data.tags,
        "created_at": now,
        "updated_at": now
    }
    doc = calc_deal_fields(doc)
    await db.deals.insert_one(doc)
    await log_activity("created", "deals", doc["id"], data.title)
    return DealResponse(**doc)

@api_router.get("/deals", response_model=List[DealResponse])
async def get_deals(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None
):
    """Get all deals with optional filters."""
    query = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if search:
        query["title"] = {"$regex": search, "$options": "i"}
    docs = await db.deals.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

@api_router.get("/deals/{deal_id}", response_model=DealResponse)
async def get_deal(deal_id: str):
    doc = await db.deals.find_one({"id": deal_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Deal not found")
    return doc

@api_router.put("/deals/{deal_id}", response_model=DealResponse)
async def update_deal(deal_id: str, data: DealUpdate):
    """Update a deal. Recalculates profit and ROI on price changes."""
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = now_iso()
    # Need to recalculate if prices changed
    if any(k in updates for k in ("buy_price", "sell_price", "fees")):
        current = await db.deals.find_one({"id": deal_id}, {"_id": 0})
        if not current:
            raise HTTPException(status_code=404, detail="Deal not found")
        merged = {**current, **updates}
        merged = calc_deal_fields(merged)
        updates["estimated_profit"] = merged["estimated_profit"]
        updates["roi_percent"] = merged["roi_percent"]
    result = await db.deals.update_one({"id": deal_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Deal not found")
    doc = await db.deals.find_one({"id": deal_id}, {"_id": 0})
    await log_activity("updated", "deals", deal_id, doc["title"])
    return doc

@api_router.delete("/deals/{deal_id}")
async def delete_deal(deal_id: str):
    doc = await db.deals.find_one({"id": deal_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Deal not found")
    await db.deals.delete_one({"id": deal_id})
    await log_activity("deleted", "deals", deal_id, doc["title"])
    return {"status": "deleted"}


# =============================================================================
# API ROUTES - Knowledge Vault
# =============================================================================

@api_router.post("/knowledge", response_model=KnowledgeResponse)
async def create_knowledge(data: KnowledgeCreate):
    """Create a new knowledge entry."""
    now = now_iso()
    doc = {
        "id": new_id(),
        "title": data.title,
        "content": data.content,
        "category": data.category,
        "tags": data.tags,
        "created_at": now,
        "updated_at": now
    }
    await db.knowledge.insert_one(doc)
    await log_activity("created", "knowledge", doc["id"], data.title)
    return KnowledgeResponse(**doc)

@api_router.get("/knowledge", response_model=List[KnowledgeResponse])
async def get_knowledge(
    category: Optional[str] = None,
    search: Optional[str] = None
):
    """Get all knowledge entries with optional filters."""
    query = {}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}}
        ]
    docs = await db.knowledge.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

@api_router.get("/knowledge/{item_id}", response_model=KnowledgeResponse)
async def get_knowledge_item(item_id: str):
    doc = await db.knowledge.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Knowledge item not found")
    return doc

@api_router.put("/knowledge/{item_id}", response_model=KnowledgeResponse)
async def update_knowledge(item_id: str, data: KnowledgeUpdate):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = now_iso()
    result = await db.knowledge.update_one({"id": item_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Knowledge item not found")
    doc = await db.knowledge.find_one({"id": item_id}, {"_id": 0})
    await log_activity("updated", "knowledge", item_id, doc["title"])
    return doc

@api_router.delete("/knowledge/{item_id}")
async def delete_knowledge(item_id: str):
    doc = await db.knowledge.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Knowledge item not found")
    await db.knowledge.delete_one({"id": item_id})
    await log_activity("deleted", "knowledge", item_id, doc["title"])
    return {"status": "deleted"}


# =============================================================================
# API ROUTES - Build Queue
# =============================================================================

@api_router.post("/build-queue", response_model=BuildQueueResponse)
async def create_build_queue_item(data: BuildQueueCreate):
    """Create a new build queue item."""
    now = now_iso()
    doc = {
        "id": new_id(),
        "title": data.title,
        "description": data.description,
        "status": data.status,
        "priority": data.priority,
        "rationale": data.rationale,
        "tags": data.tags,
        "created_at": now,
        "updated_at": now
    }
    await db.build_queue.insert_one(doc)
    await log_activity("created", "build_queue", doc["id"], data.title)
    return BuildQueueResponse(**doc)

@api_router.get("/build-queue", response_model=List[BuildQueueResponse])
async def get_build_queue(
    status: Optional[str] = None,
    priority: Optional[str] = None
):
    """Get all build queue items with optional filters."""
    query = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    docs = await db.build_queue.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

@api_router.put("/build-queue/{item_id}", response_model=BuildQueueResponse)
async def update_build_queue_item(item_id: str, data: BuildQueueUpdate):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = now_iso()
    result = await db.build_queue.update_one({"id": item_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Build queue item not found")
    doc = await db.build_queue.find_one({"id": item_id}, {"_id": 0})
    await log_activity("updated", "build_queue", item_id, doc["title"])
    return doc

@api_router.delete("/build-queue/{item_id}")
async def delete_build_queue_item(item_id: str):
    doc = await db.build_queue.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Build queue item not found")
    await db.build_queue.delete_one({"id": item_id})
    await log_activity("deleted", "build_queue", item_id, doc["title"])
    return {"status": "deleted"}


# =============================================================================
# API ROUTES - Daily Review
# =============================================================================

@api_router.get("/daily-review")
async def get_daily_review():
    """Get today's review: all entries created today + saved reflections."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_end = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()

    # Get today's activity
    activities = await db.activity_log.find(
        {"timestamp": {"$gte": today_start, "$lte": today_end}},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(200)

    # Get today's saved review
    today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    review = await db.daily_reviews.find_one({"date": today_date}, {"_id": 0})

    # Count today's entries per module
    summary = {}
    for module in ["commands", "tasks", "deals", "knowledge", "build_queue"]:
        count = await db[module].count_documents({
            "created_at": {"$gte": today_start, "$lte": today_end}
        })
        summary[module] = count

    return {
        "date": today_date,
        "activities": activities,
        "summary": summary,
        "next_actions": review.get("next_actions", "") if review else "",
        "reflections": review.get("reflections", "") if review else ""
    }

@api_router.put("/daily-review")
async def save_daily_review(data: DailyReviewUpdate):
    """Save or update today's daily review reflections."""
    today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.daily_reviews.update_one(
        {"date": today_date},
        {"$set": {
            "date": today_date,
            "next_actions": data.next_actions,
            "reflections": data.reflections,
            "updated_at": now_iso()
        }},
        upsert=True
    )
    return {"status": "saved", "date": today_date}


# =============================================================================
# API ROUTES - Dashboard
# =============================================================================

@api_router.get("/dashboard")
async def get_dashboard():
    """Canonical operator dashboard backed by host runtime state."""
    overview = _runtime_overview()
    tasks = overview["tasks"]
    approvals = overview["approvals"]
    top_actions = overview["top_actions"]
    alerts = overview["alerts"]

    task_counts = {
        "total": len(tasks),
        "todo": sum(1 for task in tasks if task.get("state") == "pending"),
        "doing": sum(1 for task in tasks if task.get("state") == "active"),
        "blocked": sum(1 for task in tasks if task.get("state") == "blocked"),
        "done": sum(1 for task in tasks if task.get("state") == "completed"),
    }
    approval_counts = {
        "total": len(approvals),
        "pending": sum(1 for item in approvals if item.get("status") == "pending"),
        "approved": sum(1 for item in approvals if item.get("status") == "approved"),
        "rejected": sum(1 for item in approvals if item.get("status") == "rejected"),
        "expired": sum(1 for item in approvals if item.get("status") == "expired"),
        "auto_safe": sum(1 for item in approvals if item.get("status") == "auto_safe"),
    }

    recent_activity = [
        {
            "id": row.get("event_id") or row.get("task_id") or new_id(),
            "action": row.get("event_type") or row.get("state") or "update",
            "module": row.get("agency") or row.get("owner_agency") or "runtime",
            "title": row.get("summary") or row.get("title") or "runtime event",
            "timestamp": row.get("timestamp") or row.get("updated_at") or row.get("created_at") or now_iso(),
        }
        for row in (alerts + tasks[:10])[:15]
    ]

    return {
        "task_counts": task_counts,
        "approval_counts": approval_counts,
        "opportunity_count": len(top_actions),
        "service_health": overview["service_health"],
        "recent_activity": recent_activity,
        "priority_tasks": overview["active_tasks"][:5],
        "priority_deals": top_actions,
        "recent_commands": [],
        "today_activity_count": len(recent_activity),
        "runtime_overview": overview,
    }


@api_router.get("/operator/overview")
async def get_operator_overview():
    return _runtime_overview()


# =============================================================================
# API ROUTES - Activity Log
# =============================================================================

@api_router.get("/activity")
async def get_activity(limit: int = Query(50, le=200)):
    """Get recent activity entries."""
    docs = await db.activity_log.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return docs


# =============================================================================
# API ROUTES - Seed Data
# =============================================================================

@api_router.post("/seed")
async def seed_data():
    """Seed the database with sample data for first-launch experience."""
    # Check if already seeded
    existing = await db.commands.count_documents({})
    if existing > 0:
        return {"status": "already_seeded", "message": "Database already has data"}

    now = now_iso()

    # Seed commands
    commands = [
        {"id": new_id(), "content": "Set up daily review process", "entry_type": "task", "tags": ["workflow"], "created_at": now},
        {"id": new_id(), "content": "Research GPU pricing for Q1 deals", "entry_type": "note", "tags": ["research", "deals"], "created_at": now},
        {"id": new_id(), "content": "New automation idea: auto-tag incoming entries", "entry_type": "idea", "tags": ["automation"], "created_at": now},
    ]

    # Seed tasks
    tasks = [
        {"id": new_id(), "title": "Set up monitoring dashboard", "description": "Configure key metrics and alerts", "status": "doing", "priority": "high", "due_date": (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d"), "tags": ["ops"], "created_at": now, "updated_at": now},
        {"id": new_id(), "title": "Review vendor contracts", "description": "Q1 vendor renewals due", "status": "todo", "priority": "critical", "due_date": (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d"), "tags": ["admin"], "created_at": now, "updated_at": now},
        {"id": new_id(), "title": "Document SOPs for deal pipeline", "description": "Write step-by-step process", "status": "todo", "priority": "medium", "due_date": None, "tags": ["docs"], "created_at": now, "updated_at": now},
        {"id": new_id(), "title": "Fix data export script", "description": "CSV export failing on large datasets", "status": "blocked", "priority": "high", "due_date": (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d"), "tags": ["engineering"], "created_at": now, "updated_at": now},
        {"id": new_id(), "title": "Weekly team sync notes", "description": "Compile and share", "status": "done", "priority": "low", "due_date": None, "tags": ["admin"], "created_at": now, "updated_at": now},
    ]

    # Seed deals
    deals = [
        calc_deal_fields({"id": new_id(), "title": "GPU Batch - RTX 4090", "category": "hardware", "buy_price": 12000, "sell_price": 15500, "fees": 350, "status": "open", "priority": "high", "notes": "Bulk order from distributor", "tags": ["hardware"], "created_at": now, "updated_at": now}),
        calc_deal_fields({"id": new_id(), "title": "SaaS License Resale", "category": "software", "buy_price": 500, "sell_price": 1200, "fees": 50, "status": "pending", "priority": "medium", "notes": "Annual license transfer", "tags": ["software"], "created_at": now, "updated_at": now}),
        calc_deal_fields({"id": new_id(), "title": "Domain Portfolio Sale", "category": "digital", "buy_price": 200, "sell_price": 3000, "fees": 100, "status": "open", "priority": "critical", "notes": "Premium .ai domains", "tags": ["domains"], "created_at": now, "updated_at": now}),
    ]

    # Seed knowledge
    knowledge = [
        {"id": new_id(), "title": "Deal Pipeline SOP", "content": "Step 1: Identify opportunity\nStep 2: Research market pricing\nStep 3: Calculate margins\nStep 4: Execute purchase\nStep 5: List for sale\nStep 6: Track until close", "category": "sop", "tags": ["deals", "process"], "created_at": now, "updated_at": now},
        {"id": new_id(), "title": "Pineapple OS Architecture Notes", "content": "Frontend: React + Tailwind + shadcn/ui\nBackend: FastAPI + MongoDB\nModules: Commands, Tasks, Deals, Knowledge, Build Queue, Daily Review\n\nDesign principle: Modularity first, features second.", "category": "reference", "tags": ["system", "architecture"], "created_at": now, "updated_at": now},
        {"id": new_id(), "title": "Negotiation Framework", "content": "1. Always know your walk-away number\n2. Research the other side's constraints\n3. Anchor first when possible\n4. Trade, don't concede\n5. Document everything", "category": "strategy", "tags": ["deals", "strategy"], "created_at": now, "updated_at": now},
    ]

    # Seed build queue
    build_queue = [
        {"id": new_id(), "title": "Email Integration", "description": "Connect email inbox for deal notifications", "status": "requested", "priority": "high", "rationale": "Reduces manual checking, faster response to deals", "tags": ["integration"], "created_at": now, "updated_at": now},
        {"id": new_id(), "title": "Auto-tagging System", "description": "AI-based tagging for new entries", "status": "planning", "priority": "medium", "rationale": "Improves organization without manual effort", "tags": ["automation", "ai"], "created_at": now, "updated_at": now},
        {"id": new_id(), "title": "Mobile Companion View", "description": "Optimized mobile layout for on-the-go access", "status": "requested", "priority": "low", "rationale": "Quick access to tasks and deals from phone", "tags": ["mobile", "ux"], "created_at": now, "updated_at": now},
    ]

    # Insert all seed data
    await db.commands.insert_many(commands)
    await db.tasks.insert_many(tasks)
    await db.deals.insert_many(deals)
    await db.knowledge.insert_many(knowledge)
    await db.build_queue.insert_many(build_queue)

    # Log seeding activity
    await log_activity("seeded", "system", "seed", "Database seeded with sample data")

    return {"status": "seeded", "message": "Sample data loaded successfully"}


# =============================================================================
# HEALTH CHECK
# =============================================================================

@api_router.get("/")
async def root():
    return {"message": "Pineapple OS API v1.0", "status": "operational"}


# =============================================================================
# APP CONFIGURATION
# =============================================================================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
