from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any
import logging

# Set up logging
logger = logging.getLogger(__name__)

# Create the router
router = APIRouter()

# Pydantic models for request/response
class CustomerEmailRequest(BaseModel):
    email: EmailStr

class CustomerInfoResponse(BaseModel):
    customer_id: str
    email: str

class ModuleResponse(BaseModel):
    subscription_id: str
    status: str
    items: List[Dict[str, Any]]
    current_period_start: int
    current_period_end: int

class CustomerModulesResponse(BaseModel):
    customer_id: str
    email: str
    modules: List[Dict[str, Any]]

# Dependency to get Stripe service
def get_stripe_service():
    from app.service.stripe_modules import StripeModuleService
    try:
        service = StripeModuleService()
        return service
    except Exception as e:
        logger.error(f"Failed to create StripeModuleService: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to initialize Stripe service")

@router.post("/customer-info", response_model=CustomerInfoResponse)
async def get_customer_info(
    request: CustomerEmailRequest,
    stripe_service = Depends(get_stripe_service)
):
    """
    Get customer information by email
    """
    try:
        customer_id = stripe_service.get_customer_id(request.email)
        return CustomerInfoResponse(
            customer_id=customer_id,
            email=request.email
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting customer info: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/customer-modules", response_model=CustomerModulesResponse)
async def get_customer_modules(
    request: CustomerEmailRequest,
    stripe_service = Depends(get_stripe_service)
):
    """
    Get all modules (subscriptions) for a customer by email
    """
    try:
        customer_id = stripe_service.get_customer_id(request.email)
        
        # Use service method to get modules
        modules_response = stripe_service.get_modules(request.email)
        
        # Convert Stripe response to serializable format
        modules_list = []
        
        # Handle Stripe ListObject properly
        if hasattr(modules_response, 'data'):
            subscription_data = modules_response.data
        else:
            # Try alternative access methods
            subscription_data = list(modules_response)
        
        for subscription in subscription_data:
            # Access items as dictionary key, not method
            items_obj = subscription['items']
            
            # Handle Stripe ListObject properly
            if hasattr(items_obj, 'data'):
                items_data = items_obj.data
            else:
                items_data = list(items_obj)
            
            module_data = {
                "subscription_id": subscription.id,
                "status": subscription.status,
                "current_period_start": subscription.current_period_start,
                "current_period_end": subscription.current_period_end,
                "items": [
                    {
                        "id": item.id,
                        "price_id": item.price.id,
                        "product_id": item.price.product,
                        "quantity": item.quantity,
                        "amount": item.price.unit_amount,
                        "currency": item.price.currency,
                        "interval": item.price.recurring.interval if item.price.recurring else None
                    }
                    for item in items_data
                ]
            }
            modules_list.append(module_data)
        
        return CustomerModulesResponse(
            customer_id=customer_id,
            email=request.email,
            modules=modules_list
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting customer modules: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


