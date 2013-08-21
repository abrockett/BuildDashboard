Ext.define("Rally.apps.builddashboard.Calculator", {

    prepareChartData: function (store) {
        console.log('Preparing Chart Data');
        var categories = [];
        var successes = [];
        var total = [];
        var percent = [];

        store.each(function(record) {
            if (!Ext.Array.contains(categories, record.get('_CreatedAt'))) {
                Ext.Array.insert(categories, categories.length, [record.get('_CreatedAt')]);
                if (record.get('Status') === 'SUCCESS') {
                    Ext.Array.insert(successes, successes.length, [1]);
                } else {
                    Ext.Array.insert(successes, successes.length, [0]);
                }
                Ext.Array.insert(total, total.length, [1]);
            } else {
                if (record.get('Status') === 'SUCCESS') {
                    successes[Ext.Array.indexOf(categories, record.get('_CreatedAt'))] += 1;
                }
                total[Ext.Array.indexOf(categories, record.get('_CreatedAt'))] += 1;
            }
        });
        
        var length = successes.length;
        var xaxis = [];
        var totalSuccesses = 0;
        var totalCount = 0;

        Ext.Array.each(successes, function(name, index, array) {
            Ext.Array.insert(percent, percent.length, [successes[index]*100/total[index]]);
            totalSuccesses += successes[index];
        });

        Ext.Array.each(total, function(name, index, array) {
            totalCount += total[index];
        });

        var successRatio = Ext.util.Format.number(totalSuccesses/totalCount*100, '0.0');

        for (i = 0; i < percent.length; i++) {
            Ext.Array.insert(xaxis, xaxis.length, [i]);
        }

        if (percent[0] === 0){
            percent[0] = 0.01; //gets mad if data given is purely a zero array
        }

        //test for getting slope of trendline!
        var line = this._findLineByLeastSquares(xaxis, percent);
        var lineData = line[0];
        var lineSlope = line[1];
        //debugger;

        return {
            categories: categories,
            ratio: successRatio,
            slope: lineSlope,
            series: [
                {
                    type: 'column',
                    name: 'Successful Build Percentage',
                    data: percent,
                    color: '#5C9ACB'
                },
                {
                    type: 'line',
                    data: lineData,
                    marker: {
                        enabled: false
                    }
                }
            ]

        };
    },

    _findLineByLeastSquares: function(values_x, values_y) {
        console.log('Least squares function');
        var sum_x = 0;
        var sum_y = 0;
        var sum_xy = 0;
        var sum_xx = 0;
        var count = 0;

        /*
        * We'll use those variables for faster read/write access.
        */
        var x = 0;
        var y = 0;
        var values_length = values_x.length;

        if (values_length != values_y.length) {
            throw new Error('The parameters values_x and values_y need to have same size!');
        }

        /*
        * Nothing to do.
        */
        if (values_length === 0) {
            return [ [], [] ];
        }

        /*
        * Calculate the sum for each of the parts necessary.
        */
        for (var v = 0; v < values_length; v++) {
            x = values_x[v];
            y = values_y[v];
            
            sum_x += x;
            sum_y += parseInt(y, 10);
            sum_xx += x*x;
            sum_xy += x*y;
            count++;
        }

        /*
        * Calculate m and b for the formular:
        * y = x * m + b
        */

        var m = (count*sum_xy - sum_x*sum_y) / (count*sum_xx - sum_x*sum_x);


        var b = (sum_y/count) - (m*sum_x)/count;

        /*
        * We will make the x and y result line now
        */
        var result_values_x = [];
        var result_values_y = [];

        for (v = 0; v < values_length; v++) {
            x = values_x[v];
            y = x * m + b;
            result_values_x.push(x);
            result_values_y.push(y);
        }

        var finalArray = [];
        for (i=0; i<result_values_x.length; i++) {
            Ext.Array.insert(finalArray, finalArray.length, [[result_values_x[i], result_values_y[i]]]);
        }
        
        return [finalArray,m];
    }
});