from datetime import date
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import SessionLocal
from .schemas import CalculateRequest
from . import services

from fastapi.responses import StreamingResponse
from .export_excel import build_excel_file


app = FastAPI(title="SPP Test Task")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


active_connections = {}


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "SPP Service is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/dates")
def get_dates(db: Session = Depends(get_db)):
    return services.get_available_dates(db)


@app.get("/api/tree")
def get_tree(version_date: date, db: Session = Depends(get_db)):
    return services.get_tree_for_date(db, version_date)


@app.post("/api/calculate")
def calculate(
    request: CalculateRequest,
    db: Session = Depends(get_db)
):
    try:
        redis_id, tree = services.calculate_distribution(
            db=db,
            selected_ids=request.selected_ids,
            total_amount=request.total_amount,
            version_date=request.version_date,
            session_id=request.session_id
        )

        return {
            "redis_id": redis_id,
            "tree": tree
        }

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/api/save/{redis_id}")
async def save_calculation(
    redis_id: str,
    db: Session = Depends(get_db)
):
    try:
        calculation = services.save_calculation_from_redis(db, redis_id)

        session_id = calculation.session_id

        if session_id in active_connections:
            for connection in active_connections[session_id]:
                await connection.send_json({
                    "type": "calculation_saved",
                    "calculation_id": calculation.id
                })

        return {
            "id": calculation.id,
            "status": calculation.status
        }

    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))


@app.get("/api/calculations")
def calculations(
    session_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    items = services.get_calculations(db, session_id)

    return [
        {
            "id": item.id,
            "session_id": item.session_id,
            "status": item.status,
            "spp_version_date": item.spp_version_date,
            "created_at": item.created_at
        }
        for item in items
    ]


@app.get("/api/calculations/{calculation_id}")
def calculation_detail(
    calculation_id: int,
    db: Session = Depends(get_db)
):
    item = services.get_calculation_by_id(db, calculation_id)

    if not item:
        raise HTTPException(status_code=404, detail="Расчет не найден")

    return {
        "id": item.id,
        "session_id": item.session_id,
        "status": item.status,
        "spp_version_date": item.spp_version_date,
        "created_at": item.created_at,
        "result_json": item.result_json
    }

@app.get("/api/export/{calculation_id}")
def export_calculation(
    calculation_id: int,
    db: Session = Depends(get_db)
):
    calculation = services.get_calculation_by_id(db, calculation_id)

    if not calculation:
        raise HTTPException(status_code=404, detail="Расчет не найден")

    file_stream = build_excel_file({
        "id": calculation.id,
        "result_json": calculation.result_json
    })

    filename = f"spp_calculation_{calculation.id}.xlsx"

    return StreamingResponse(
        file_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()

    active_connections.setdefault(session_id, []).append(websocket)

    try:
        while True:
            await websocket.receive_text()
    except Exception:
        active_connections[session_id].remove(websocket)