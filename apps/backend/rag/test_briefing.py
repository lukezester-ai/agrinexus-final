import asyncio
from orchestrator_router import daily_briefing, BriefingRequest

async def main():
    req = BriefingRequest(location="Русе", commodity="wheat", farmContext=[])
    print("Fetching briefing...")
    res = await daily_briefing(req)
    print("Result:")
    print(res)

if __name__ == "__main__":
    asyncio.run(main())
