import json
import os
import sys
import pandas as pd
import xalpha as xa


def fetch_fund_data(fund_list_path="config/fund_list.json", data_dir="data"):
    with open(fund_list_path, "r", encoding="utf-8") as f:
        fund_list = json.load(f)

    os.makedirs(data_dir, exist_ok=True)

    for fund in fund_list:
        code = fund["code"]
        name = fund.get("name", code)
        print(f"正在拉取: {code} {name}")

        try:
            info = xa.fundinfo(code, priceonly=True)
            df = info.price.copy()
        except Exception as e:
            print(f"  拉取失败: {e}")
            continue

        df = df.sort_values("date").reset_index(drop=True)

        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
        df["net"] = df["netvalue"].astype(float)

        df["change_pct"] = df["net"].pct_change() * 100
        df["change_pct"] = df["change_pct"].round(2)
        df.loc[df.index[0], "change_pct"] = 0.0

        result = df[["date", "net", "change_pct"]].to_dict(orient="records")

        out_path = os.path.join(data_dir, f"{code}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        print(f"  完成: {len(result)} 条记录 -> {out_path}")

    print("所有基金数据更新完成！")


if __name__ == "__main__":
    fund_list_path = sys.argv[1] if len(sys.argv) > 1 else "config/fund_list.json"
    data_dir = sys.argv[2] if len(sys.argv) > 2 else "data"
    fetch_fund_data(fund_list_path, data_dir)
