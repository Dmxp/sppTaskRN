import json
import uuid
from datetime import date
from typing import List, Dict, Optional

from sqlalchemy.orm import Session

from .models import SppItem, Department, SppDepartment, Calculation
from .redis_client import redis_client


REDIS_TTL_SECONDS = 60 * 30


def get_available_dates(db: Session):
    rows = (
        db.query(SppItem.valid_from)
        .distinct()
        .order_by(SppItem.valid_from)
        .all()
    )

    return [row[0].isoformat() for row in rows]


def get_tree_for_date(db: Session, version_date: date):
    items = (
        db.query(SppItem)
        .filter(SppItem.valid_from <= version_date)
        .filter((SppItem.valid_to == None) | (SppItem.valid_to >= version_date))
        .order_by(SppItem.code)
        .all()
    )

    departments_map = _get_departments_map(db)

    nodes = []

    for item in items:
        nodes.append({
            "id": item.id,
            "parent_id": item.parent_id,
            "code": item.code,
            "name": item.name,
            "is_active": item.is_active,
            "valid_from": item.valid_from.isoformat() if item.valid_from else None,
            "valid_to": item.valid_to.isoformat() if item.valid_to else None,
            "departments": departments_map.get(item.id, []),
            "children": [],
            "amount": 0.0
        })

    return _build_tree(nodes)


def _get_departments_map(db: Session) -> Dict[int, List[dict]]:
    rows = (
        db.query(SppDepartment, Department)
        .join(Department, SppDepartment.department_id == Department.id)
        .all()
    )

    result = {}

    for link, department in rows:
        result.setdefault(link.spp_id, []).append({
            "id": department.id,
            "name": department.name
        })

    return result


def _build_tree(nodes: List[dict]):
    by_id = {node["id"]: node for node in nodes}
    roots = []

    for node in nodes:
        parent_id = node["parent_id"]

        if parent_id is not None and parent_id in by_id:
            by_id[parent_id]["children"].append(node)
        else:
            roots.append(node)

    return roots


def calculate_distribution(
    db: Session,
    selected_ids: List[int],
    total_amount: float,
    version_date: date,
    session_id: str
):
    tree = get_tree_for_date(db, version_date)

    if not selected_ids:
        raise ValueError("Не выбраны элементы СПП")

    branch_amount = round(total_amount / len(selected_ids), 2)

    for root in tree:
        _apply_distribution(root, selected_ids, branch_amount)

    redis_id = str(uuid.uuid4())

    payload = {
        "session_id": session_id,
        "version_date": version_date.isoformat(),
        "selected_ids": selected_ids,
        "total_amount": round(total_amount, 2),
        "tree": tree
    }

    redis_client.setex(
        f"calculation:{redis_id}",
        REDIS_TTL_SECONDS,
        json.dumps(payload, ensure_ascii=False)
    )

    return redis_id, tree


def _apply_distribution(node: dict, selected_ids: List[int], branch_amount: float):
    if node["id"] in selected_ids:
        return _distribute_inside_branch(node, branch_amount)

    total = 0.0

    for child in node["children"]:
        total += _apply_distribution(child, selected_ids, branch_amount)

    node["amount"] = round(total, 2)

    return node["amount"]


def _distribute_inside_branch(node: dict, amount: float):
    children = node["children"]

    if not children:
        node["amount"] = round(amount, 2)
        return node["amount"]

    child_amount = round(amount / len(children), 2)

    total = 0.0

    for child in children:
        total += _distribute_inside_branch(child, child_amount)

    node["amount"] = round(total, 2)

    return node["amount"]


def save_calculation_from_redis(db: Session, redis_id: str):
    raw = redis_client.get(f"calculation:{redis_id}")

    if raw is None:
        raise ValueError("Расчет не найден в Redis или истек TTL")

    payload = json.loads(raw)

    calculation = Calculation(
        session_id=payload["session_id"],
        status="SAVED",
        spp_version_date=payload["version_date"],
        result_json=payload
    )

    db.add(calculation)
    db.commit()
    db.refresh(calculation)

    redis_client.delete(f"calculation:{redis_id}")

    return calculation


def get_calculations(db: Session, session_id: Optional[str] = None):
    query = db.query(Calculation).order_by(Calculation.created_at.desc())

    if session_id:
        query = query.filter(Calculation.session_id == session_id)

    return query.all()


def get_calculation_by_id(db: Session, calculation_id: int):
    return (
        db.query(Calculation)
        .filter(Calculation.id == calculation_id)
        .first()
    )