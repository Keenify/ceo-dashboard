import stripe
import os
from dotenv import load_dotenv

load_dotenv()

class StripeModuleService:
    def __init__(self):
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
    
    # retrieve the customer id from the database by email
    def get_customer_id(self, email):
        # get the customer id from the database
        customers = stripe.Customer.list(email=email)
        if not customers.data:
            raise ValueError(f"No customer found with email: {email}")
        customer_id = customers.data[0].id
        return customer_id

    # retrieve the modules from the database by customer id
    def get_modules(self, email):
        # get the modules from the database
        customer_id = self.get_customer_id(email)
        modules = stripe.Subscription.list(customer=customer_id)
        return modules
    
    # retrieve the modules by customer id directly
    def get_modules_by_customer_id(self, customer_id):
        # get the modules from the database by customer id
        modules = stripe.Subscription.list(customer=customer_id)
        return modules

if __name__ == "__main__":
    email = "test@gmail.com"
    
    stripe_service = StripeModuleService()
    
    # print the email
    print(f"email: {email}")
    customer_id = stripe_service.get_customer_id(email)
    print(f"customer_id: {customer_id}")

    # print the modules
    modules = stripe_service.get_modules(email)
    print(f"modules: {modules}")
