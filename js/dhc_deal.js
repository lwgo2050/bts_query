var ws = new ReconnectingWebSocket("wss://bit.btsabc.org/ws");
ws.debug = false;
ws.timeoutInterval = 40000;
ws.reconnectInterval = 12000;
var param = {
    "id" : 1,
    "method" : "call",
    "params" : [ 0, "get_limit_orders", [ "1.3.113", "1.3.3084", 10000] ]
};
var base_symbol = "CNY"
var quote_symbol = "GDEX.DHT"
var base_id = "1.3.113";
var base_precision = 4;
var quote_id = "1.3.3084";
var quote_precision = 5;
var queryResultStr="";

// 查询条件参数
var query_asset_name="GDEX.BKBT"
var query_order_type = "bid";
var query_order_price = 0;


var account_set = new Set();
var limit_orders;
var query_result = [];

// Websocket连接异常
ws.onerror = function(event) {
    alert("WebSocket链接异常" + event.data);
};

//与WebSocket建立连接
ws.onopen = function(event) {
    var param1 ={"id":1,"method":"call","params":[0,"lookup_asset_symbols",[[query_asset_name]]]};
    ws.send(JSON.stringify(param1));
};

//处理服务器返回的信息
ws.onmessage = function(event) {
    // alert(event.data)
    var data = JSON.parse(event.data);
    if (data.id === 1) {
        deal_asset_sysmbol_message(data);
        return;
    }
    else if (data.id === 2) 
    {
        deal_asset_order_result(data);
    }
    else if (data.id === 3) {
        // 获取账户名称
        deal_order_account_name(data.result);
    }
}

// 处理限价中的用户ID和用户名称
function deal_order_account_name(accounts) {
    var account_map = new Map();
    for (var i = 0; i < accounts.length; i++) {
        account_map.set(accounts[i].id, accounts[i].name);
    }
    
   
    for (var i = 0; i < query_result.rows.length; i++) {
        var account_name = account_map.get(query_result.rows[i].account_id);
        
        // alert(account_name);
        if (account_name != undefined) {
            query_result.rows[i].account_name = account_name;
        }
        else {
            query_result.rows[i].account_name = query_result[i].account_id;
        }
    }
    loadData();
}

function deal_asset_order_result(data1) {
    // 计算限价单数据
    var data = get_order_book(data1.result);
    // alert(data.bids.length);
    //$('#tb_departments').bootstrapTable('load', data.bids);
    // $('#tb_departments').bootstrapTable('refresh');
    //查询结果以及总额统计｛"quote_total":0,"base_totoal":0,rows:[]｝
    //格式：总量:quote_total，金额：base_totoal,以及rows：记录
    if (query_order_type === 'ask') {
        query_result = getLowThanbAskPrice(data.asks);
    } else {
        query_result = getMoreThanBidPrice(data.bids);
    }
    
    var arr = Array.from(account_set);
    var param3 = {
            "id" : 3,
            "method" : "call",
            "params" : [ 0, "get_accounts", [arr]]
        };
 // 查询对应的限价单
    ws.send(JSON.stringify(param3));
}


function loadData(){
    $('#quote_total').html(formatValue(query_result.quote_total,2));
    $('#base_total').html(formatValue(query_result.base_total,2));
    
    $('#tb_departments').bootstrapTable('load', query_result.rows);

    $("#tb_departments").bootstrapTable("refreshOptions",{sortStable:true});
    $("#tb_departments").bootstrapTable("refreshOptions",{pageNumber:1});
    $('#tb_departments').bootstrapTable('refresh');
    queryResultStr ='<span style="color:#FF0000">'+ "CNY: "+query_asset_name+"查询成功</span>";
    hideProgress();
}

function deal_asset_sysmbol_message(data) {
    account_set.clear();
    if (data.result[0] === null) {
        alert("没有查询到对应的资产");
        queryResultStr = '<span style="color:#FF0000">'+"没有在Bitshares公有链上查询对应的资产"+query_asset_name+"请再次确认资产名称输入是否正确 </span>";
        hideProgress();
    }
    else {
        quote_id = data.result[0].id;
        quote_precision = data.result[0].precision;
        var param2 = {
                "id" : 2,
                "method" : "call",
                "params" : [ 0, "get_limit_orders", [ base_id, quote_id, 10000] ]
            };
     // 查询对应的限价单
        ws.send(JSON.stringify(param2));
    }
}

function getAccountsName(accountIds){

    
}


function hideProgress() {
    // 隐藏查询进度条
    $('#title').html("当前查询的是："+queryResultStr);
    $("#loadingModal").modal('hide');
}


// 查询限价单列表
var get_order_book = function(limit_orders) {
    var orderBook = new Object();
    orderBook.base = base_symbol;
    orderBook.quote = quote_symbol;

    var asks = [];
    var bids = [];

    for (var i = 0; i < limit_orders.length; i++) {
        var o = limit_orders[i];
        // bids 处理限价买单
        if (o.sell_price.base.asset_id == base_id) {
            var ord = new Object();
            ord.account_id = o.seller;
            account_set.add(o.seller);
            ord.price = price_to_real(o.sell_price);
            ord.quote = asset_to_real(
                    ((o.for_sale * o.sell_price.quote.amount) / o.sell_price.base.amount),
                    quote_precision);
            ord.base = asset_to_real(o.for_sale, base_precision);
            bids.push(ord);
        }
        // asks 处理限价卖单
        else {
            var ord = new Object();
            ord.account_id = o.seller;
            account_set.add(o.seller);
            ord.price = price_to_real(o.sell_price);
            ord.quote = asset_to_real(o.for_sale, quote_precision);
            ord.base = asset_to_real(
                    ((o.for_sale * o.sell_price.quote.amount) / o.sell_price.base.amount),
                    base_precision);
            asks.push(ord);
            }
        }

    orderBook.asks = asks;
    orderBook.bids = bids;
    return orderBook;
}

// 价格处理　sell_price
var price_to_real = function(price) {
	if (price.base.asset_id == base_id)
		return asset_to_real(price.base.amount, base_precision)
				/ asset_to_real(price.quote.amount, quote_precision);
	else
		return asset_to_real(price.quote.amount, base_precision)
				/ asset_to_real(price.base.amount, quote_precision);
}

// 根据asset precision 计算精度，sellprice,precision
var asset_to_real = function(amount, precision) {
    return amount / Math.pow(10, precision);
}

// 获取高于买价以上的所有量和需要总金额统计
var getMoreThanBidPrice = function(data) {
    var result = new Object();
    var quote_total = 0;
    var base_total = 0;
    var rows = [];
    for (var i = 0; i < data.length; i++) {
        var order = data[i];
        if (order.price > query_order_price) {
            quote_total = quote_total + order.quote;
            base_total = base_total + order.base;
            rows.push(order)
            }
    }
    result.quote_total = quote_total;
    result.base_total = base_total;
    result.rows = rows;
    return result;
}

// 获取低于卖价的所有量和需要总金额统计
var getLowThanbAskPrice = function(data) {
    var result = new Object();
    var quote_total = 0;
    var base_total = 0;
    var rows = [];
    if (query_order_price > 0) {
        for (var i = 0; i < data.length; i++) {
            var order = data[i];
            if (order.price < query_order_price) {
                quote_total = quote_total + order.quote;
                base_total = base_total + order.base;
                rows.push(order);
            }
        }
    } else {
        for (var i = 0; i < data.length; i++) {
            var order = data[i];
            quote_total = quote_total + order.quote;
            base_total = base_total + order.base;
            rows.push(order);
        }
    }
    result.quote_total = quote_total;
    result.base_total = base_total;
    result.rows = rows;
    return result;
}

// 格式化金额数字函数
var formatValue = function (s, n) { 
    n = n > 0 && n <= 20 ? n : 2; 
    s = parseFloat((s + "").replace(/[^\d\.-]/g, "")).toFixed(n) + ""; 
    var l = s.split(".")[0].split("").reverse(), r = s.split(".")[1]; 
    t = ""; 
    for (i = 0; i < l.length; i++) { 
        t += l[i] + ((i + 1) % 3 == 0 && (i + 1) != l.length ? "," : ""); 
        } 
    return t.split("").reverse().join("") + "." + r; 
} 

$(function() {
    $button = $('#btn_query'); // 处理查询点击
    $button.click(function() {
        query_asset_name = $('#search_asset').val();
        query_order_type = $('#search_ordertype').val(); // 限价单类型
        query_order_price = $('#search_price').val(); //限价单范围
        if (isNaN(query_order_price)) {
            alert("输入了一个非法的数值，将被替换成默认值0查询所有");
            query_order_price = 0;
        }
    var param1 ={"id":1,"method":"call","params":[0,"lookup_asset_symbols",[[query_asset_name]]]};
    ws.send(JSON.stringify(param1));
    // 查询进度条显示, 点击进度条会自动消除
    $("#loadingModal").modal('show');
    
    
});
});
