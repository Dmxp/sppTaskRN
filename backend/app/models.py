from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Date,
    ForeignKey,
    TIMESTAMP,
    func
)

from sqlalchemy.dialects.postgresql import JSONB

from .database import Base


class SppItem(Base):
    __tablename__ = "spp_items"

    id = Column(Integer, primary_key=True)

    parent_id = Column(
        Integer,
        ForeignKey("spp_items.id"),
        nullable=True
    )

    code = Column(String)
    name = Column(String)

    is_active = Column(Boolean)

    valid_from = Column(Date)
    valid_to = Column(Date)

    created_at = Column(
        TIMESTAMP,
        server_default=func.now()
    )


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True)

    name = Column(String, unique=True)


class SppDepartment(Base):
    __tablename__ = "spp_departments"

    id = Column(Integer, primary_key=True)

    spp_id = Column(
        Integer,
        ForeignKey("spp_items.id")
    )

    department_id = Column(
        Integer,
        ForeignKey("departments.id")
    )


class Calculation(Base):
    __tablename__ = "calculations"

    id = Column(Integer, primary_key=True)

    session_id = Column(String)

    status = Column(String)

    spp_version_date = Column(Date)

    result_json = Column(JSONB)

    created_at = Column(
        TIMESTAMP,
        server_default=func.now()
    )