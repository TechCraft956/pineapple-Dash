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
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import json
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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

# Map of entity types to their collection names and title fields
ENTITY_COLLECTIONS = {
    "tasks": {"collection": "tasks", "title_field": "title"},
    "deals": {"collection": "deals", "title_field": "title"},
    "knowledge": {"collection": "knowledge", "title_field": "title"},
    "build_queue": {"collection": "build_queue", "title_field": "title"},
    "infrastructure": {"collection": "infrastructure", "title_field": "service_name"},
    "commands": {"collection": "commands", "title_field": "content"},
}

async def get_entity_title(entity_type: str, entity_id: str) -> str:
    """Get the display title for any entity."""
    info = ENTITY_COLLECTIONS.get(entity_type)
    if not info:
        return "Unknown"
    doc = await db[info["collection"]].find_one({"id": entity_id}, {"_id": 0, info["title_field"]: 1})
    if not doc:
        return "Deleted"
    return doc.get(info["title_field"], "Untitled")


# =============================================================================
# PYDANTIC MODELS - Shared conventions across all entities
# =============================================================================

# --- Commands ---
class CommandCreate(BaseModel):
    content: str
    entry_type: str = "note"  # task, deal, note, idea, trade, system, build, infrastructure
    tags: List[str] = []
    route_to_entity: bool = False  # If true, also creates the entity in its module
    entity_data: Optional[dict] = None  # Extra data for entity creation

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

# --- Infrastructure Registry ---
class InfrastructureCreate(BaseModel):
    service_name: str
    friendly_name: str = ""
    category: str = "app"  # app, api, db, agent, proxy, model, automation
    runtime: str = "local"  # local, docker, emergent, vps
    environment: str = "dev"  # dev, staging, prod
    host_machine: str = ""
    internal_hostname: str = ""
    internal_port: Optional[int] = None
    external_port: Optional[int] = None
    url: str = ""
    docker_compose_project: str = ""
    docker_network: str = ""
    repo_path: str = ""
    healthcheck_url: str = ""
    status: str = "unknown"  # running, stopped, unknown, broken
    notes: str = ""
    tags: List[str] = []

class InfrastructureUpdate(BaseModel):
    service_name: Optional[str] = None
    friendly_name: Optional[str] = None
    category: Optional[str] = None
    runtime: Optional[str] = None
    environment: Optional[str] = None
    host_machine: Optional[str] = None
    internal_hostname: Optional[str] = None
    internal_port: Optional[int] = None
    external_port: Optional[int] = None
    url: Optional[str] = None
    docker_compose_project: Optional[str] = None
    docker_network: Optional[str] = None
    repo_path: Optional[str] = None
    healthcheck_url: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None

class InfrastructureResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    service_name: str
    friendly_name: str
    category: str
    runtime: str
    environment: str
    host_machine: str
    internal_hostname: str
    internal_port: Optional[int]
    external_port: Optional[int]
    url: str
    docker_compose_project: str
    docker_network: str
    repo_path: str
    healthcheck_url: str
    status: str
    notes: str
    tags: List[str]
    created_at: str
    updated_at: str

# --- Entity Links ---
class EntityLinkCreate(BaseModel):
    source_type: str  # tasks, deals, knowledge, build_queue, infrastructure, commands
    source_id: str
    target_type: str
    target_id: str

class EntityLinkResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    source_type: str
    source_id: str
    source_title: str
    target_type: str
    target_id: str
    target_title: str
    created_at: str

# --- Daily Review ---
class DailyReviewUpdate(BaseModel):
    next_actions: str = ""
    reflections: str = ""


# =============================================================================
# API ROUTES - Commands
# =============================================================================

@api_router.post("/commands", response_model=CommandResponse)
async def create_command(data: CommandCreate):
    """Create a new command entry from the Command Center.
    If route_to_entity is True, also creates the entity in its target module."""
    doc = {
        "id": new_id(),
        "content": data.content,
        "entry_type": data.entry_type,
        "tags": data.tags,
        "created_at": now_iso()
    }
    routed_entity_id = None

    # Route to entity if requested
    if data.route_to_entity and data.entry_type in ("task", "deal", "build", "infrastructure"):
        now = now_iso()
        extra = data.entity_data or {}
        if data.entry_type == "task":
            entity_doc = {
                "id": new_id(), "title": data.content, "description": extra.get("description", ""),
                "status": extra.get("status", "todo"), "priority": extra.get("priority", "medium"),
                "due_date": extra.get("due_date"), "tags": data.tags,
                "created_at": now, "updated_at": now
            }
            await db.tasks.insert_one(entity_doc)
            await log_activity("created", "tasks", entity_doc["id"], data.content[:80])
            routed_entity_id = entity_doc["id"]
        elif data.entry_type == "deal":
            entity_doc = {
                "id": new_id(), "title": data.content, "category": extra.get("category", ""),
                "buy_price": extra.get("buy_price", 0), "sell_price": extra.get("sell_price", 0),
                "fees": extra.get("fees", 0), "status": extra.get("status", "open"),
                "priority": extra.get("priority", "medium"), "notes": extra.get("notes", ""),
                "tags": data.tags, "created_at": now, "updated_at": now
            }
            entity_doc = calc_deal_fields(entity_doc)
            await db.deals.insert_one(entity_doc)
            await log_activity("created", "deals", entity_doc["id"], data.content[:80])
            routed_entity_id = entity_doc["id"]
        elif data.entry_type == "build":
            entity_doc = {
                "id": new_id(), "title": data.content, "description": extra.get("description", ""),
                "status": extra.get("status", "requested"), "priority": extra.get("priority", "medium"),
                "rationale": extra.get("rationale", ""), "tags": data.tags,
                "created_at": now, "updated_at": now
            }
            await db.build_queue.insert_one(entity_doc)
            await log_activity("created", "build_queue", entity_doc["id"], data.content[:80])
            routed_entity_id = entity_doc["id"]
        elif data.entry_type == "infrastructure":
            entity_doc = {
                "id": new_id(), "service_name": data.content, "friendly_name": extra.get("friendly_name", ""),
                "category": extra.get("category", "app"), "runtime": extra.get("runtime", "local"),
                "environment": extra.get("environment", "dev"), "host_machine": extra.get("host_machine", ""),
                "internal_hostname": extra.get("internal_hostname", ""), "internal_port": extra.get("internal_port"),
                "external_port": extra.get("external_port"), "url": extra.get("url", ""),
                "docker_compose_project": extra.get("docker_compose_project", ""),
                "docker_network": extra.get("docker_network", ""), "repo_path": extra.get("repo_path", ""),
                "healthcheck_url": extra.get("healthcheck_url", ""), "status": extra.get("status", "unknown"),
                "notes": extra.get("notes", ""), "tags": data.tags,
                "created_at": now, "updated_at": now
            }
            await db.infrastructure.insert_one(entity_doc)
            await log_activity("created", "infrastructure", entity_doc["id"], data.content[:80])
            routed_entity_id = entity_doc["id"]

    doc["routed_entity_id"] = routed_entity_id
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
# API ROUTES - Infrastructure Registry
# =============================================================================

@api_router.post("/infrastructure", response_model=InfrastructureResponse)
async def create_infrastructure(data: InfrastructureCreate):
    """Create a new infrastructure record."""
    now = now_iso()
    doc = {
        "id": new_id(),
        "service_name": data.service_name,
        "friendly_name": data.friendly_name,
        "category": data.category,
        "runtime": data.runtime,
        "environment": data.environment,
        "host_machine": data.host_machine,
        "internal_hostname": data.internal_hostname,
        "internal_port": data.internal_port,
        "external_port": data.external_port,
        "url": data.url,
        "docker_compose_project": data.docker_compose_project,
        "docker_network": data.docker_network,
        "repo_path": data.repo_path,
        "healthcheck_url": data.healthcheck_url,
        "status": data.status,
        "notes": data.notes,
        "tags": data.tags,
        "created_at": now,
        "updated_at": now,
    }
    await db.infrastructure.insert_one(doc)
    await log_activity("created", "infrastructure", doc["id"], data.service_name)
    return InfrastructureResponse(**doc)

@api_router.get("/infrastructure", response_model=List[InfrastructureResponse])
async def get_infrastructure(
    category: Optional[str] = None,
    runtime: Optional[str] = None,
    environment: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    """Get infrastructure records with optional filters."""
    query = {}
    if category:
        query["category"] = category
    if runtime:
        query["runtime"] = runtime
    if environment:
        query["environment"] = environment
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"service_name": {"$regex": search, "$options": "i"}},
            {"friendly_name": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.infrastructure.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

@api_router.get("/infrastructure/{item_id}", response_model=InfrastructureResponse)
async def get_infrastructure_item(item_id: str):
    doc = await db.infrastructure.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Infrastructure record not found")
    return doc

@api_router.put("/infrastructure/{item_id}", response_model=InfrastructureResponse)
async def update_infrastructure(item_id: str, data: InfrastructureUpdate):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = now_iso()
    result = await db.infrastructure.update_one({"id": item_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Infrastructure record not found")
    doc = await db.infrastructure.find_one({"id": item_id}, {"_id": 0})
    await log_activity("updated", "infrastructure", item_id, doc.get("service_name", ""))
    return doc

@api_router.delete("/infrastructure/{item_id}")
async def delete_infrastructure(item_id: str):
    doc = await db.infrastructure.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Infrastructure record not found")
    await db.infrastructure.delete_one({"id": item_id})
    # Also clean up any links referencing this entity
    await db.entity_links.delete_many({"$or": [
        {"source_type": "infrastructure", "source_id": item_id},
        {"target_type": "infrastructure", "target_id": item_id},
    ]})
    await log_activity("deleted", "infrastructure", item_id, doc["service_name"])
    return {"status": "deleted"}


# =============================================================================
# API ROUTES - Entity Links
# =============================================================================

@api_router.post("/links", response_model=EntityLinkResponse)
async def create_entity_link(data: EntityLinkCreate):
    """Create a link between two entities."""
    # Validate both entities exist
    source_title = await get_entity_title(data.source_type, data.source_id)
    target_title = await get_entity_title(data.target_type, data.target_id)
    if source_title == "Deleted" or target_title == "Deleted":
        raise HTTPException(status_code=404, detail="One or both entities not found")
    # Check for duplicate
    existing = await db.entity_links.find_one({
        "source_type": data.source_type, "source_id": data.source_id,
        "target_type": data.target_type, "target_id": data.target_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Link already exists")
    doc = {
        "id": new_id(),
        "source_type": data.source_type,
        "source_id": data.source_id,
        "source_title": source_title,
        "target_type": data.target_type,
        "target_id": data.target_id,
        "target_title": target_title,
        "created_at": now_iso(),
    }
    await db.entity_links.insert_one(doc)
    await log_activity("linked", "entity_links", doc["id"], f"{source_title} → {target_title}")
    return EntityLinkResponse(**doc)

@api_router.get("/links", response_model=List[EntityLinkResponse])
async def get_entity_links(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
):
    """Get links for a specific entity (both directions)."""
    if entity_type and entity_id:
        query = {"$or": [
            {"source_type": entity_type, "source_id": entity_id},
            {"target_type": entity_type, "target_id": entity_id},
        ]}
    else:
        query = {}
    docs = await db.entity_links.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

@api_router.delete("/links/{link_id}")
async def delete_entity_link(link_id: str):
    result = await db.entity_links.delete_one({"id": link_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Link not found")
    return {"status": "deleted"}


# =============================================================================
# API ROUTES - Global Search
# =============================================================================

@api_router.get("/search")
async def global_search(q: str = Query(..., min_length=1)):
    """Search across all entity collections."""
    regex = {"$regex": q, "$options": "i"}
    results = []

    # Search tasks
    tasks = await db.tasks.find(
        {"$or": [{"title": regex}, {"description": regex}]}, {"_id": 0}
    ).to_list(20)
    for t in tasks:
        results.append({"type": "tasks", "id": t["id"], "title": t["title"],
                        "subtitle": t.get("status", ""), "priority": t.get("priority", ""),
                        "updated_at": t.get("updated_at", t.get("created_at", ""))})

    # Search deals
    deals = await db.deals.find(
        {"$or": [{"title": regex}, {"notes": regex}]}, {"_id": 0}
    ).to_list(20)
    for d in deals:
        results.append({"type": "deals", "id": d["id"], "title": d["title"],
                        "subtitle": d.get("status", ""), "priority": d.get("priority", ""),
                        "updated_at": d.get("updated_at", d.get("created_at", ""))})

    # Search knowledge
    knowledge = await db.knowledge.find(
        {"$or": [{"title": regex}, {"content": regex}]}, {"_id": 0}
    ).to_list(20)
    for k in knowledge:
        results.append({"type": "knowledge", "id": k["id"], "title": k["title"],
                        "subtitle": k.get("category", ""), "priority": "",
                        "updated_at": k.get("updated_at", k.get("created_at", ""))})

    # Search build queue
    builds = await db.build_queue.find(
        {"$or": [{"title": regex}, {"description": regex}]}, {"_id": 0}
    ).to_list(20)
    for b in builds:
        results.append({"type": "build_queue", "id": b["id"], "title": b["title"],
                        "subtitle": b.get("status", ""), "priority": b.get("priority", ""),
                        "updated_at": b.get("updated_at", b.get("created_at", ""))})

    # Search infrastructure
    infra = await db.infrastructure.find(
        {"$or": [{"service_name": regex}, {"friendly_name": regex}, {"notes": regex}]}, {"_id": 0}
    ).to_list(20)
    for i in infra:
        results.append({"type": "infrastructure", "id": i["id"], "title": i["service_name"],
                        "subtitle": f"{i.get('runtime', '')} / {i.get('environment', '')}",
                        "priority": "", "updated_at": i.get("updated_at", i.get("created_at", ""))})

    # Search commands
    commands = await db.commands.find(
        {"content": regex}, {"_id": 0}
    ).to_list(20)
    for c in commands:
        results.append({"type": "commands", "id": c["id"], "title": c["content"][:100],
                        "subtitle": c.get("entry_type", ""), "priority": "",
                        "updated_at": c.get("created_at", "")})

    # Sort by updated_at descending
    results.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    return {"query": q, "total": len(results), "results": results[:50]}


# =============================================================================
# API ROUTES - Export
# =============================================================================

@api_router.get("/export/json")
async def export_json(module: Optional[str] = None):
    """Export all data or a specific module as JSON."""
    export_data = {}
    modules_to_export = [module] if module else ["tasks", "deals", "knowledge", "build_queue", "infrastructure", "commands"]
    for m in modules_to_export:
        collection_name = m
        if m == "build_queue":
            collection_name = "build_queue"
        docs = await db[collection_name].find({}, {"_id": 0}).to_list(10000)
        export_data[m] = docs
    # Include links
    if not module:
        links = await db.entity_links.find({}, {"_id": 0}).to_list(10000)
        export_data["entity_links"] = links
    json_str = json.dumps(export_data, indent=2, default=str)
    return StreamingResponse(
        io.BytesIO(json_str.encode()),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=pineapple-export-{datetime.now(timezone.utc).strftime('%Y%m%d')}.json"}
    )

@api_router.get("/export/csv/{module}")
async def export_csv(module: str):
    """Export a specific module as CSV."""
    valid_modules = ["tasks", "deals", "knowledge", "build_queue", "infrastructure", "commands"]
    if module not in valid_modules:
        raise HTTPException(status_code=400, detail=f"Invalid module. Choose from: {valid_modules}")
    docs = await db[module].find({}, {"_id": 0}).to_list(10000)
    if not docs:
        raise HTTPException(status_code=404, detail="No data to export")
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=docs[0].keys())
    writer.writeheader()
    for doc in docs:
        # Convert lists to comma-separated strings for CSV
        row = {}
        for k, v in doc.items():
            if isinstance(v, list):
                row[k] = ", ".join(str(x) for x in v)
            else:
                row[k] = v
        writer.writerow(row)
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={module}-export-{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"}
    )


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
    """Aggregated dashboard data: counts, recent activity, priority items, computed insights."""
    # Counts
    task_counts = {
        "total": await db.tasks.count_documents({}),
        "todo": await db.tasks.count_documents({"status": "todo"}),
        "doing": await db.tasks.count_documents({"status": "doing"}),
        "blocked": await db.tasks.count_documents({"status": "blocked"}),
        "done": await db.tasks.count_documents({"status": "done"})
    }
    deal_counts = {
        "total": await db.deals.count_documents({}),
        "open": await db.deals.count_documents({"status": "open"}),
        "pending": await db.deals.count_documents({"status": "pending"}),
        "closed": await db.deals.count_documents({"status": "closed"})
    }
    knowledge_count = await db.knowledge.count_documents({})
    build_queue_count = await db.build_queue.count_documents({"status": {"$ne": "done"}})

    # Recent activity
    recent_activity = await db.activity_log.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).to_list(15)

    # Priority items (high/critical tasks not done)
    priority_tasks = await db.tasks.find(
        {"priority": {"$in": ["high", "critical"]}, "status": {"$ne": "done"}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10)

    # Priority deals
    priority_deals = await db.deals.find(
        {"priority": {"$in": ["high", "critical"]}, "status": {"$in": ["open", "pending"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10)

    # Recent entries (last 5 commands)
    recent_commands = await db.commands.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(5)

    # Today summary
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_end = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
    today_activities = await db.activity_log.count_documents({
        "timestamp": {"$gte": today_start, "$lte": today_end}
    })

    # =========================================================================
    # COMPUTED INTELLIGENCE
    # =========================================================================
    stale_threshold = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    # Stale tasks (not done, not updated in 7+ days)
    stale_tasks = await db.tasks.find(
        {"status": {"$ne": "done"}, "updated_at": {"$lt": stale_threshold}},
        {"_id": 0}
    ).sort("updated_at", 1).to_list(10)

    # Stale deals (open/pending, not updated in 7+ days)
    stale_deals = await db.deals.find(
        {"status": {"$in": ["open", "pending"]}, "updated_at": {"$lt": stale_threshold}},
        {"_id": 0}
    ).sort("updated_at", 1).to_list(10)

    # Today queue (tasks due today or overdue, not done)
    today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_queue = await db.tasks.find(
        {"status": {"$ne": "done"}, "due_date": {"$lte": today_date, "$ne": None}},
        {"_id": 0}
    ).sort("due_date", 1).to_list(20)

    # Build queue urgency (high/critical, not done)
    build_urgent = await db.build_queue.find(
        {"priority": {"$in": ["high", "critical"]}, "status": {"$ne": "done"}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10)

    # Infrastructure health summary
    infra_total = await db.infrastructure.count_documents({})
    infra_running = await db.infrastructure.count_documents({"status": "running"})
    infra_stopped = await db.infrastructure.count_documents({"status": "stopped"})
    infra_broken = await db.infrastructure.count_documents({"status": "broken"})
    infra_unknown = await db.infrastructure.count_documents({"status": "unknown"})

    system_health = {
        "total": infra_total,
        "running": infra_running,
        "stopped": infra_stopped,
        "broken": infra_broken,
        "unknown": infra_unknown,
    }

    return {
        "task_counts": task_counts,
        "deal_counts": deal_counts,
        "knowledge_count": knowledge_count,
        "build_queue_count": build_queue_count,
        "recent_activity": recent_activity,
        "priority_tasks": priority_tasks,
        "priority_deals": priority_deals,
        "recent_commands": recent_commands,
        "today_activity_count": today_activities,
        # Computed intelligence
        "stale_tasks": stale_tasks,
        "stale_deals": stale_deals,
        "today_queue": today_queue,
        "build_urgent": build_urgent,
        "system_health": system_health,
    }


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

    # Seed infrastructure
    infrastructure = [
        {"id": new_id(), "service_name": "pineapple-api", "friendly_name": "Pineapple OS API", "category": "api", "runtime": "docker", "environment": "prod", "host_machine": "main-server", "internal_hostname": "pineapple-api", "internal_port": 8001, "external_port": 443, "url": "https://api.pineapple.local", "docker_compose_project": "pineapple-os", "docker_network": "pineapple-net", "repo_path": "/app/backend", "healthcheck_url": "https://api.pineapple.local/api/", "status": "running", "notes": "Main API service", "tags": ["core"], "created_at": now, "updated_at": now},
        {"id": new_id(), "service_name": "pineapple-frontend", "friendly_name": "Pineapple OS Frontend", "category": "app", "runtime": "docker", "environment": "prod", "host_machine": "main-server", "internal_hostname": "pineapple-frontend", "internal_port": 3000, "external_port": 443, "url": "https://pineapple.local", "docker_compose_project": "pineapple-os", "docker_network": "pineapple-net", "repo_path": "/app/frontend", "healthcheck_url": "https://pineapple.local", "status": "running", "notes": "React SPA frontend", "tags": ["core"], "created_at": now, "updated_at": now},
        {"id": new_id(), "service_name": "mongodb", "friendly_name": "MongoDB Database", "category": "db", "runtime": "docker", "environment": "prod", "host_machine": "main-server", "internal_hostname": "mongodb", "internal_port": 27017, "external_port": None, "url": "", "docker_compose_project": "pineapple-os", "docker_network": "pineapple-net", "repo_path": "", "healthcheck_url": "", "status": "running", "notes": "Primary datastore", "tags": ["core", "database"], "created_at": now, "updated_at": now},
        {"id": new_id(), "service_name": "nginx-proxy", "friendly_name": "Nginx Reverse Proxy", "category": "proxy", "runtime": "docker", "environment": "prod", "host_machine": "main-server", "internal_hostname": "nginx", "internal_port": 80, "external_port": 443, "url": "", "docker_compose_project": "pineapple-os", "docker_network": "pineapple-net", "repo_path": "", "healthcheck_url": "", "status": "running", "notes": "SSL termination + routing", "tags": ["networking"], "created_at": now, "updated_at": now},
    ]

    # Insert all seed data
    await db.commands.insert_many(commands)
    await db.tasks.insert_many(tasks)
    await db.deals.insert_many(deals)
    await db.knowledge.insert_many(knowledge)
    await db.build_queue.insert_many(build_queue)
    await db.infrastructure.insert_many(infrastructure)

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
