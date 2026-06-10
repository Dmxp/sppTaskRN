from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import date, datetime


class DepartmentSchema(BaseModel):
    id: int
    name: str


class SppNodeSchema(BaseModel):
    id: int
    parent_id: Optional[int]
    code: str
    name: str
    is_active: bool
    valid_from: date
    valid_to: Optional[date]
    departments: List[DepartmentSchema] = []
    children: List["SppNodeSchema"] = []
    amount: float = 0


class CalculateRequest(BaseModel):
    selected_ids: List[int]
    total_amount: float
    version_date: date
    session_id: str


class CalculateResponse(BaseModel):
    redis_id: str
    tree: List[SppNodeSchema]


class SaveResponse(BaseModel):
    id: int
    status: str


class CalculationListItem(BaseModel):
    id: int
    session_id: str
    status: str
    spp_version_date: date
    created_at: datetime


class CalculationDetail(BaseModel):
    id: int
    session_id: str
    status: str
    spp_version_date: date
    result_json: Any
    created_at: datetime