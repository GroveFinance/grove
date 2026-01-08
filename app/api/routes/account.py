from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.crud import account as crud
from app.db import get_db
from app.logger import logger
from app.schemas import (
    AccountCreate,
    AccountDetailsOut,
    AccountMergeRequest,
    AccountMergeResponse,
    AccountOut,
    AccountUpdate,
    DuplicateAccountGroup,
)

router = APIRouter()


@router.get("/", response_model=list[AccountDetailsOut], operation_id="get_accounts")
def get_accounts(
    account_id: str | None = None,
    org_id: str | None = None,
    is_hidden: bool | None = False,
    db: Session = Depends(get_db),
):
    return crud.get_account_details(db, account_id=account_id, org_id=org_id, is_hidden=is_hidden)


@router.post("/", response_model=AccountOut, operation_id="create_account")
def create_account(data: AccountCreate, db: Session = Depends(get_db)):
    return crud.create_account(db, data)


@router.get(
    "/duplicates",
    response_model=list[DuplicateAccountGroup],
    operation_id="get_duplicate_accounts",
)
def get_duplicate_accounts(db: Session = Depends(get_db)):
    """Find accounts that appear to be duplicates (same org_id + name)."""
    try:
        duplicates = crud.find_duplicate_accounts(db)
        # Convert Account models to AccountDetailsOut schemas with balance info
        result = []
        for group in duplicates:
            accounts_with_balance = []
            for acc in group["accounts"]:
                balance_info = crud._get_latest_balance(db, acc.id)
                # Create AccountDetailsOut with all required fields
                account_details = AccountDetailsOut(
                    account_id=acc.id,
                    name=acc.name,
                    alt_name=acc.alt_name,
                    display_name=acc.alt_name if acc.alt_name else acc.name,
                    currency=acc.currency,
                    account_type=acc.account_type,
                    org_name=acc.org.name,
                    org_domain=acc.org.domain,
                    balance=balance_info["balance"],
                    balance_date=balance_info["balance_date"],
                    created_at=acc.created_at,
                    is_hidden=acc.is_hidden if hasattr(acc, "is_hidden") else False,
                )
                accounts_with_balance.append(account_details)

            result.append(
                DuplicateAccountGroup(
                    org_id=group["org_id"],
                    name=group["name"],
                    accounts=accounts_with_balance,
                )
            )
        return result
    except Exception as e:
        logger.exception("Error finding duplicate accounts")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/{id}", response_model=AccountOut, operation_id="get_account")
def get_account(id: str, db: Session = Depends(get_db)):
    account = crud.get_account_by_id(db, id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.put("/{id}", response_model=AccountOut, operation_id="update_account")
def update_account(id: str, data: AccountUpdate, db: Session = Depends(get_db)):
    account = crud.update_account(db, id, data)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.delete("/{id}", response_model=AccountOut, operation_id="delete_account")
def delete_account(id: str, db: Session = Depends(get_db)):
    account = crud.delete_account(db, id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.post("/merge", response_model=AccountMergeResponse, operation_id="merge_accounts")
def merge_accounts(request: AccountMergeRequest, db: Session = Depends(get_db)):
    """Merge two accounts, preserving user categorization."""
    try:
        stats = crud.merge_accounts(
            db,
            source_account_id=request.source_account_id,
            target_account_id=request.target_account_id,
            preserve_categorization=request.preserve_categorization,
        )
        return AccountMergeResponse(
            success=True,
            message=f"Successfully merged {request.source_account_id} into {request.target_account_id}",
            **stats,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Error merging accounts")
        raise HTTPException(status_code=500, detail=str(e)) from e
