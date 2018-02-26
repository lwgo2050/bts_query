var Api = window.bitshares_ws;
var startDate = new Date();
var endDate = new Date();
var dataArr = new Array();
var account_set = new Set();
var holders = new Array();
var symbols;

let server = "wss://ws.gdex.top";
Api.instance(server, true).init_promise.then((res) => {
    console.log(res)
}).catch(err => {
    console.log("err:", err);
    reconnect();
})

function reconnect(){
    Api.instance(server, true).init_promise.then((res) => {
        console.log(res)
    }).catch(err => {
        console.log("err:", err);
        reconnect();
    })
}

function lookupAccounts(startChar, limit = 1) {
    return Api.instance().db_api().exec("lookup_accounts", [
        startChar, limit
    ]).then(accounts => {
        let newInput = accounts.map(account => {
            return account[0];
        });
        return Apis.instance().db_api().exec("get_full_accounts", [newInput, false]);
    }).catch(err => {
        console.log("err:", err);
    })
}

function toUnixStamp(date){
    return (new Date(date)).toISOString().slice(0,-5); 
}


$(function() {
    $button = $('#btn_query'); // 处理查询点击
    $button.click(function() {
        dataArr = []; // 清除缓存数据
        account_set.clear();
        holders =[];
        query_asset_name = $('#search_asset').val();
        if ($('#startDate').val()=='' || $('#startDate').val()==null) {
            alert('请选择开始时间');
            return;
        }
        else {
            startDate = new Date($('#startDate').val());
        }
        
        if ($('#startDate').val()=='' || $('#startDate').val()==null) {
            alert('请选择结束时间');
            return;
        }
        else {
           endDate = new Date(($('#endDate').val()))
        }
        
        if (startDate<endDate) {
            alert('开始时间要大于结束时间，否则查不到数据');
            return;
        }
        
        console.log(startDate);
        console.log(endDate);
         
        $("#loadingModal").modal('show');
        Api.instance().db_api().exec("lookup_asset_symbols",[['CNY',query_asset_name]])
        .then(asset_symbols=>{
            symbols=asset_symbols;
            var last = new Date();
            while (startDate>endDate) {
                var start = toUnixStamp(startDate);
                var end = toUnixStamp(getLastOneMinute(startDate));
                // console.log(start);
                // console.log(end);
                last = startDate;
                startDate = getLastOneMinute(startDate);
                // console.log(startDate);
                Api.instance().db_api().exec( "get_trade_history", ['CNY', query_asset_name,toUnixStamp(start),toUnixStamp(end),100])
                .then(response => {
                    console.log(response);
                    for (var i = 0; i < response.length; i++) {
                        account_set.add(response[i].side1_account_id);
                        account_set.add(response[i].side2_account_id);
                    }
                });
            } 
            
            // 最后一次查询
            console.log('last query');
            console.log(last);
            console.log(endDate);
            Api.instance().db_api().exec( "get_trade_history", ['CNY', query_asset_name,toUnixStamp(last),toUnixStamp(endDate),100])
            .then(response => {
                console.log(response);
                for (var i = 0; i < response.length; i++) {
                    account_set.add(response[i].side1_account_id);
                    account_set.add(response[i].side2_account_id);
                }
                get_full_account();
            });
        });
});
});

// 获取前一分钟
function getLastOneMinute(date){
    var d = new Date(date);
    d.setHours(d.getHours()-1);
    return d;
}

function get_full_account() {
    Api.instance().db_api().exec("get_full_accounts", [Array.from(account_set),false])
    .then(accounts => {
        console.log(accounts);
        // 获取所有持有查询货币账户的名字
        // 需要统计可用余额和限价单的总和，目前暂定只统计查询壁钟和可用CNY
        for (var i = 0; i < accounts.length; i++) {
            var holder = new Object();
            var balance = accounts[i][1].balances;
            var limit_orders = accounts[i][1].limit_orders;
            holder.account_id = accounts[i][0];
            holder.account_name = accounts[i][1].account.name;
            
            // 处理balance
            for (var j = 0; j < balance.length;j++) {
                if (balance[j].asset_type == symbols[1].id) {
                    holder.coin_amount = parseInt(balance[j].balance);
                }
                
                if (balance[j].asset_type == symbols[0].id) {
                    holder.cny = parseInt(balance[j].balance);
                }
            }
            
            // 处理 limit orders  统计CNY买 quote coin卖base
            for (var j = 0; j < limit_orders.length; j++) {
                if (limit_orders[j].sell_price.base.asset_id == symbols[1].id) {
                    holder.coin_amount = holder.coin_amount + parseInt(limit_orders[j].sell_price.base.amount);
                }
                if (limit_orders[j].sell_price.base.asset_id == symbols[0].id) {
                    holder.cny = holder.cny + parseInt(limit_orders[j].sell_price.base.amount);
                }
            }
            
            if (holder.coin_amount > 0 ) {
                // 处理percision 获取喂价信息，计算市值
                // console.log(holder.coin_amount);
                holder.coin_amount = asset_to_real(holder.coin_amount,symbols[1].precision);
                // console.log(holder.coin_amount);
                holder.cny = asset_to_real(holder.cny, symbols[0].precision);
                
                holders.push(holder);
            }
            //console.log(holders);
            loadData(holders);
        }
    });
}

function loadData(data){
    $('#tb_account').bootstrapTable('load',data);
    $("#tb_account").bootstrapTable("refreshOptions",{sortStable:true});
    $("#tb_account").bootstrapTable("refreshOptions",{pageNumber:1});
    $('#tb_account').bootstrapTable('refresh');
    queryResultStr ='<span style="color:#FF0000">'+ "CNY: "+query_asset_name+"查询成功</span>";
 // 隐藏查询进度条
    $('#title').html("当前查询的是："+queryResultStr);
    $("#loadingModal").modal('hide');
}
    