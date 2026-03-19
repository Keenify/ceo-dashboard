#!/usr/bin/env python3
"""
MCP Server Entry Point
Main server that exposes all MCP tools to MCP clients like Claude
"""

import asyncio
import json
import sys
from typing import Dict, Any, List
import logging

from app.mcp.habit_tools import HabitMCPServer

logger = logging.getLogger(__name__)

class MCPServer:
    """Main MCP Server that aggregates all tool servers"""
    
    def __init__(self):
        """Initialize the MCP Server with all available tool servers"""
        self.habit_server = HabitMCPServer()
        self.servers = {
            "habits": self.habit_server
        }
        logger.info("MCP Server initialized with habit tools")
    
    def list_all_tools(self) -> List[Dict[str, Any]]:
        """List all available tools from all servers"""
        all_tools = []
        
        # Add habit tools
        habit_tools = self.habit_server.list_tools()
        for tool in habit_tools:
            tool["server"] = "habits"
            all_tools.append(tool)
        
        return all_tools
    
    async def call_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool by name with parameters"""
        try:
            # Route to appropriate server based on tool name
            if tool_name in ["get_user_habits", "get_habit_by_id", "get_habit_entries", "get_habit_streak"]:
                return await self.habit_server.call_tool(tool_name, parameters)
            else:
                return {
                    "success": False,
                    "error": f"Unknown tool: {tool_name}",
                    "available_tools": [tool["name"] for tool in self.list_all_tools()]
                }
        except Exception as e:
            logger.exception(f"Error calling tool {tool_name}: {str(e)}")
            return {
                "success": False,
                "error": f"Error executing tool {tool_name}: {str(e)}"
            }
    
    def get_server_info(self) -> Dict[str, Any]:
        """Get information about the MCP server"""
        return {
            "name": "CEO Dashboard MCP Server",
            "version": "1.0.0",
            "description": "MCP server for CEO Dashboard habit tracking and productivity tools",
            "servers": list(self.servers.keys()),
            "total_tools": len(self.list_all_tools()),
            "tools": self.list_all_tools()
        }


# Global MCP server instance
mcp_server = MCPServer()


async def main():
    """Main CLI interface for the MCP server"""
    if len(sys.argv) < 2:
        print("Usage: python mcp_server.py <command> [args...]")
        print("\nCommands:")
        print("  info - Show server information")
        print("  list-tools - List all available tools")
        print("  call-tool <tool_name> <parameters_json> - Call a specific tool")
        print("\nExample:")
        print('  python mcp_server.py call-tool get_user_habits \'{"user_id": "your-uuid"}\'')
        return
    
    command = sys.argv[1]
    
    if command == "info":
        info = mcp_server.get_server_info()
        print(json.dumps(info, indent=2))
    
    elif command == "list-tools":
        tools = mcp_server.list_all_tools()
        print(json.dumps(tools, indent=2))
    
    elif command == "call-tool":
        if len(sys.argv) < 4:
            print("Error: tool_name and parameters required")
            print("Usage: python mcp_server.py call-tool <tool_name> <parameters_json>")
            return
        
        tool_name = sys.argv[2]
        
        try:
            parameters = json.loads(sys.argv[3])
        except json.JSONDecodeError:
            print("Error: Invalid JSON in parameters")
            return
        
        result = await mcp_server.call_tool(tool_name, parameters)
        print(json.dumps(result, indent=2))
    
    else:
        print(f"Unknown command: {command}")
        print("Use 'python mcp_server.py' to see available commands")


if __name__ == "__main__":
    # Setup logging
    logging.basicConfig(level=logging.INFO)
    
    # Run the main function
    asyncio.run(main()) 