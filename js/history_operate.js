 var Api = window.bitshares_ws;
 var starteDate = new Date();
 var endDate = new Date;

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


$(function() {
    $button = $('#btn_query'); // 处理查询点击
    $button.click(function() {
        query_asset_name = $('#search_asset').val();
        if ($('#startDate').val()=='' || $('#startDate').val()==null) {
            alert('请选择开始时间');
            return;
        }
        else {
            startDate = (new Date($('#startDate').val())).toISOString().slice(0,-5);
        }
        
        if ($('#startDate').val()=='' || $('#startDate').val()==null) {
            alert('请选择结束时间');
            return;
        }
        else {
           endDate = (new Date(($('#endDate').val()))).toISOString().slice(0,-5); 
        }
        
        if (startDate<endDate) {
            alert('开始时间要大于结束时间，否则查不到数据，从开始时间往前查询最多100条数据');
        }
        
        // startDate = convetToUnixTime($('#startDate').val()); 
        // endDate = convetToUnixTime($('#endDate').val()); 
        // alert(startDate);
         
    // 查询进度条显示, 点击进度条会自动消除
    //Api.instance().history_api().exec( "get_market_history", ['1.3.113', '1.3.3084',86400,startDate,endDate])
    //Api.instance().history_api().exec( "get_fill_order_history", ['1.3.113', '1.3.3084',1000])
        Api.instance().db_api().exec( "get_trade_history", ['CNY', query_asset_name,startDate,endDate,100])
        .then(response => {
            $("#loadingModal").modal('show');
        console.log(response);
        var account_set = new Set();
        for (var i = 0; i < response.length; i++) {
            account_set.add(response[i].side1_account_id);
            account_set.add(response[i].side2_account_id);
        }
        get_trade_history(response, Array.from(account_set))
    });
});
});

function get_trade_history(data, accounts) {
    Api.instance().db_api().exec("get_accounts", [accounts])
    .then(accounts => {
        console.log(accounts);
        var account_map = new Map();
        for (var i = 0; i < accounts.length; i++) {
            account_map.set(accounts[i].id, accounts[i].name);
        }
        
        // 找到对应的名字
        // var account_map = get_account_name(Array.from(account_set));
        console.log(account_map);
        for (var i = 0; i < data.length; i++) {
            data[i].seller = account_map.get(data[i].side1_account_id);
            data[i].buyer = account_map.get(data[i].side2_account_id);
            // data[i].date = convertUTC2LocalDate(data[i].date);
        }
        loadData(data);
       
    });
}

function loadData(data){
    // $('#quote_total').html(formatValue(query_result.quote_total,2));
    // $('#base_total').html(formatValue(query_result.base_total,2));
    
    $('#tb_history').bootstrapTable('load',data);

    $("#tb_history").bootstrapTable("refreshOptions",{sortStable:true});
    $("#tb_history").bootstrapTable("refreshOptions",{pageNumber:1});
    $('#tb_history').bootstrapTable('refresh');
    queryResultStr ='<span style="color:#FF0000">'+ "CNY: "+query_asset_name+"查询成功</span>";
 // 隐藏查询进度条
    $('#title').html("当前查询的是："+queryResultStr);
    $("#loadingModal").modal('hide');
}
    