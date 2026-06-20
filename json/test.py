import json

with open("./effectIcon.json", "r", encoding="utf-8") as file:
    data = json.load(file)["root"]["effect"]

ids = [item["iconId"] for item in data]
print(ids[::-1])
