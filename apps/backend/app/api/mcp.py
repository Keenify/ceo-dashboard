from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import logging

from app.mcp.mcp_server import mcp_server

logger = logging.getLogger(__name__)

router = APIRouter()

class ToolCallRequest(BaseModel):
    tool_name: str
    parameters: Dict[str, Any]

class ToolCallResponse(BaseModel):
    success: bool
    data: Any = None
    error: str = None

@router.get("/info")
async def get_server_info() -> Dict[str, Any]:
    """Get MCP server information"""
    try:
        return mcp_server.get_server_info()
    except Exception as e:
        logger.exception(f"Error getting server info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/tools")
async def list_tools() -> List[Dict[str, Any]]:
    """List all available MCP tools"""
    try:
        return mcp_server.list_all_tools()
    except Exception as e:
        logger.exception(f"Error listing tools: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.post("/call-tool")
async def call_tool(request: ToolCallRequest) -> ToolCallResponse:
    """Call an MCP tool with parameters"""
    try:
        result = await mcp_server.call_tool(request.tool_name, request.parameters)
        
        if result.get("success"):
            return ToolCallResponse(
                success=True,
                data=result.get("data"),
                error=None
            )
        else:
            return ToolCallResponse(
                success=False,
                data=None,
                error=result.get("error", "Unknown error")
            )
            
    except Exception as e:
        logger.exception(f"Error calling tool {request.tool_name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/health")
async def health_check() -> Dict[str, str]:
    """Health check endpoint"""
    return {"status": "healthy", "message": "MCP Server is running"}

@router.get("/")
async def mcp_root() -> Dict[str, str]:
    """Root endpoint with usage instructions"""
    return {
        "message": "CEO Dashboard MCP Server",
        "endpoints": {
            "info": "GET /mcp/info - Get server information",
            "tools": "GET /mcp/tools - List all available tools",
            "call-tool": "POST /mcp/call-tool - Call a specific tool",
            "health": "GET /mcp/health - Health check"
        },
        "usage": "This is an MCP server. Connect an MCP client like Claude to use these tools."
    } 