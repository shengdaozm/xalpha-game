# FundSim Game 📊

基于历史净值的基金模拟投资小游戏。使用真实基金历史净值数据，体验基金投资的酸甜苦辣。

## 特性

- **每日操作模式**：逐天推进，手动决定买入、卖出或持有，考验择时能力
- **策略投递模式**：预设自动交易策略（涨卖跌买），一键回测查看效果
- **真实数据**：基金净值数据由 [xalpha](https://github.com/refraction-ray/xalpha) 引擎从天天基金网获取
- **纯静态部署**：无需后端服务器，直接部署在 GitHub Pages
- **自动更新数据**：通过 GitHub Action 定时拉取最新基金数据

## 快速开始

### 本地运行

```bash
# 克隆仓库
git clone git@github.com:shengdaozm/xalpha-game.git
cd xalpha-game

# 启动本地服务器
python3 -m http.server 8000
```

浏览器打开 http://localhost:8000 即可游玩。

### 数据更新

基金数据通过 Python 脚本拉取，依赖 [xalpha](https://github.com/refraction-ray/xalpha)：

```bash
pip install xalpha pandas
python scripts/fetch_fund_data.py
```

在 `config/fund_list.json` 中添加或修改基金代码，运行脚本即可更新 `data/` 目录下的数据文件。

也可以通过提交 PR 修改 `config/fund_list.json`，GitHub Action 会自动拉取数据。

## 项目结构

```
xalpha-game/
├── index.html                  # 主页面
├── assets/
│   ├── app.js                  # 游戏逻辑（两种模式）
│   └── style.css               # 样式
├── config/
│   └── fund_list.json          # 基金列表配置
├── data/
│   ├── 005827.json             # 基金历史净值数据
│   ├── 161725.json
│   └── 000001.json
├── scripts/
│   └── fetch_fund_data.py      # 数据拉取脚本（基于 xalpha）
└── .github/workflows/
    └── update_fund_data.yml    # GitHub Action 自动更新数据
```

## 技术栈

- **前端**：HTML + TailwindCSS + Chart.js
- **数据脚本**：Python + [xalpha](https://github.com/refraction-ray/xalpha)
- **自动化**：GitHub Actions
- **部署**：GitHub Pages（纯静态）

## 游戏规则

### 每日操作模式

1. 选择基金和时间区间，设置初始本金
2. 游戏按日期逐天推进，每天只能看到前一天的净值和涨跌幅
3. 决定买入（投入金额）、卖出（卖出份额）或持有不动
4. 当天结束后揭示真实涨跌幅与账户变化
5. 游戏结束展示总收益率、最大回撤、交易次数、胜率

### 策略投递模式

1. 选择基金、时间区间、初始金额
2. 预设策略参数：
   - 涨幅超过 X% → 卖出 Y% 仓位
   - 跌幅超过 X% → 买入 Z% 现金
3. 系统按历史日期全自动回测执行
4. 直接输出回测报告：收益曲线、交易记录、最终收益

## 致谢

本项目使用以下开源项目，特别感谢：

- **[xalpha](https://github.com/refraction-ray/xalpha)** — 基金投资管理回测引擎，由 [@refraction-ray](https://github.com/refraction-ray) 开发。本项目的基金历史净值数据全部通过 xalpha 的 `fundinfo` 接口获取，没有 xalpha 就没有这个项目。强烈推荐有基金投资管理需求的朋友使用 xalpha。

## 免责声明

本项目仅提供基于公开历史数据的模拟投资体验，不构成任何投资建议。基金数据来自公开来源，仅供学习娱乐用途。

## License

[MIT](LICENSE)
